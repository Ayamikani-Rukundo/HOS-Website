import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, HeartHandshake, ImageUp, Pencil, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { listAdminRows, uploadPublicImage, validateImageFile } from '../lib/admin-api';
import { getSupabaseClient } from '../lib/supabase';
import { getStudentInitials } from '../lib/student-profile';

type Student = {
  id: string;
  first_name: string;
  last_name: string | null;
  school_name: string | null;
  grade_level: string | null;
  enrollment_status: string;
  status: string;
  public_bio?: string | null;
  profile_display_name?: string;
  profile_slug?: string;
  profile_photo_url?: string | null;
  school_stage?: string | null;
  family_display_name?: string | null;
  family_district?: string | null;
  is_published?: boolean;
  private_photo_path?: string | null;
};

type StudentProfile = {
  id: string;
  child_id: string;
  slug: string;
  display_name: string;
  profile_photo_url: string | null;
  public_bio: string | null;
  school_stage: string | null;
  family_display_name: string | null;
  family_district: string | null;
  is_published: boolean;
  private_photo_path: string | null;
};
type SupportUpdate = {
  id: string;
  child_id: string;
  occurred_on: string;
  category: string;
  title: string;
  private_notes: string | null;
};
type Assistance = { id: string; child_id: string | null; provided_at: string; assistance_type: string; description: string | null };
type Modal = 'student' | 'update' | null;

const categories = ['education', 'nutrition', 'health', 'family', 'mentorship', 'other'];
const gradeLevels = [
  'Nursery',
  ...Array.from({ length: 6 }, (_, index) => `Primary ${index + 1}`),
  ...Array.from({ length: 6 }, (_, index) => `Secondary ${index + 1}`),
  'TVET',
  'University',
  'Not currently enrolled',
  'Other',
];
const schoolStages = ['Early childhood', 'Primary', 'Lower secondary', 'Upper secondary', 'TVET', 'Tertiary', 'Other'];
const rwandaDistricts = [
  'Bugesera', 'Burera', 'Gakenke', 'Gasabo', 'Gatsibo', 'Gicumbi', 'Gisagara', 'Huye', 'Kamonyi', 'Karongi',
  'Kayonza', 'Kicukiro', 'Kirehe', 'Muhanga', 'Musanze', 'Ngoma', 'Ngororero', 'Nyabihu', 'Nyagatare',
  'Nyamagabe', 'Nyamasheke', 'Nyanza', 'Nyarugenge', 'Nyaruguru', 'Rubavu', 'Ruhango', 'Rulindo', 'Rusizi',
  'Rutsiro', 'Rwamagana', 'Other / outside Rwanda',
].map((district) => district.trim());
const currentDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kigali' });
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : 'The change could not be saved.';
const makeSlug = (value: string) => value.toLocaleLowerCase().trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const publicPhotoObjectPath = (url: string) => {
  const marker = '/storage/v1/object/public/hos-public/';
  const pathname = new URL(url).pathname;
  const markerIndex = pathname.indexOf(marker);
  return markerIndex < 0 ? null : decodeURIComponent(pathname.slice(markerIndex + marker.length));
};
const removePublicPhoto = async (client: ReturnType<typeof getSupabaseClient>, url: string) => {
  const path = publicPhotoObjectPath(url);
  if (!path) throw new Error('The saved photo is not in the expected public media bucket.');
  const { error } = await client.storage.from('hos-public').remove([path]);
  if (error) throw new Error(error.message);
};
const uploadPrivateStudentPhoto = async (client: ReturnType<typeof getSupabaseClient>, profileId: string, file: File) => {
  validateImageFile(file);
  const extension = file.name.split('.').pop()?.toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `student-profile-drafts/${profileId}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`;
  const { error } = await client.storage.from('hos-private').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
};
const downloadPrivateStudentPhoto = async (client: ReturnType<typeof getSupabaseClient>, path: string) => {
  const { data, error } = await client.storage.from('hos-private').download(path);
  if (error) throw new Error(error.message);
  return new File([data], path.split('/').pop() || 'student-profile-photo', { type: data.type || 'image/jpeg' });
};
const removePrivateStudentPhoto = async (client: ReturnType<typeof getSupabaseClient>, path: string) => {
  const { error } = await client.storage.from('hos-private').remove([path]);
  if (error) throw new Error(error.message);
};

export function StudentSupportWorkspace({ roles, readOnly = false }: { roles: string[]; readOnly?: boolean }) {
  const { user } = useAuth();
  const client = getSupabaseClient();
  const canPublish = roles.some((role) => ['admin', 'director', 'program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition'].includes(role));
  const [students, setStudents] = useState<Student[]>([]);
  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [updates, setUpdates] = useState<SupportUpdate[]>([]);
  const [assistance, setAssistance] = useState<Assistance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [studentDraft, setStudentDraft] = useState<Partial<Student>>({});
  const [privatePhotoPreviewUrl, setPrivatePhotoPreviewUrl] = useState<string | null>(null);
  const [supportDraft, setSupportDraft] = useState<Partial<SupportUpdate>>({});
  const [photo, setPhoto] = useState<File | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [childrenResult, profilesResult, updatesResult, assistanceResult] = await Promise.all([
      client.from('children').select('id, first_name, last_name, school_name, grade_level, enrollment_status, status').neq('status', 'closed').order('first_name'),
      client.from('student_public_profiles').select('id, child_id, slug, display_name, profile_photo_url, public_bio, school_stage, family_display_name, family_district, is_published, private_photo_path'),
      client.from('student_support_updates').select('id, child_id, occurred_on, category, title, private_notes').order('occurred_on', { ascending: false }),
      listAdminRows('assistance_records'),
    ]);
    const loadError = childrenResult.error ?? profilesResult.error ?? updatesResult.error;
    if (loadError) throw new Error(`Student workspace could not be loaded: ${loadError.message}`);
    setStudents(childrenResult.data ?? []);
    setProfiles(profilesResult.data ?? []);
    setUpdates(updatesResult.data ?? []);
    setError(null);
    setAssistance(assistanceResult.map((row) => ({
      id: String(row.id),
      child_id: typeof row.child_id === 'string' ? row.child_id : null,
      provided_at: typeof row.provided_at === 'string' ? row.provided_at : '',
      assistance_type: typeof row.assistance_type === 'string' ? row.assistance_type : 'Assistance provided',
      description: typeof row.description === 'string' ? row.description : null,
    })));
    setIsLoading(false);
  }, [client]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(refresh).catch((loadError: unknown) => {
      if (!active) return;
      setError(getErrorMessage(loadError));
      setIsLoading(false);
    });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    const path = modal === 'student' ? studentDraft.private_photo_path : null;
    if (!path) return;

    let active = true;
    void client.storage.from('hos-private').createSignedUrl(path, 300).then(({ data, error: signedUrlError }) => {
      if (signedUrlError) throw new Error(`The saved private student photo could not be previewed: ${signedUrlError.message}`);
      if (active) setPrivatePhotoPreviewUrl(data.signedUrl);
    }).catch((previewError: unknown) => {
      if (active) setError(getErrorMessage(previewError));
    });

    return () => { active = false; };
  }, [client, modal, studentDraft.private_photo_path]);

  const selectedStudent = students.find((student) => student.id === selectedId) ?? null;
  const selectedProfile = profiles.find((profile) => profile.child_id === selectedId) ?? null;
  const confirmingStudent = students.find((student) => student.id === confirmDeleteId) ?? null;
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return students.filter((student) => `${student.first_name} ${student.last_name ?? ''} ${student.school_name ?? ''}`.toLocaleLowerCase().includes(term));
  }, [search, students]);
  const timeline = useMemo(() => {
    if (!selectedId) return [];
    return [
      ...updates.filter((item) => item.child_id === selectedId).map((item) => ({
        id: item.id,
        source: 'update',
        date: item.occurred_on,
        category: item.category,
        title: item.title,
        detail: item.private_notes || '',
      })),
      ...assistance.filter((item) => item.child_id === selectedId).map((item) => ({
        id: item.id,
        source: 'assistance',
        date: item.provided_at,
        category: 'assistance',
        title: item.assistance_type,
        detail: item.description ?? '',
      })),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }, [assistance, selectedId, updates]);

  const openStudentForm = (student?: Student) => {
    if (readOnly) return;
    const profile = student ? profiles.find((item) => item.child_id === student.id) : null;
    setPrivatePhotoPreviewUrl(null);
    setError(null);
    setStudentDraft(student
      ? {
          ...student,
          public_bio: profile?.public_bio ?? '',
          profile_display_name: profile?.display_name ?? `${student.first_name} ${student.last_name ?? ''}`.trim(),
          profile_slug: profile?.slug ?? '',
          profile_photo_url: profile?.profile_photo_url ?? null,
          school_stage: profile?.school_stage ?? '',
          family_display_name: profile?.family_display_name ?? '',
          family_district: profile?.family_district ?? '',
          is_published: profile?.is_published ?? false,
          private_photo_path: profile?.private_photo_path ?? null,
        }
      : { first_name: '', last_name: '', school_name: '', grade_level: '', enrollment_status: 'unknown', status: 'active', public_bio: '', profile_display_name: '', profile_slug: '', profile_photo_url: null, school_stage: '', family_display_name: '', family_district: '', is_published: true, private_photo_path: null });
    setPhoto(null);
    setModal('student');
  };
  const openUpdateForm = (update?: SupportUpdate) => {
    if (readOnly) return;
    if (!selectedStudent) return;
    setPrivatePhotoPreviewUrl(null);
    setSupportDraft(update
      ? { ...update }
      : { child_id: selectedStudent.id, occurred_on: currentDate(), category: 'education', title: '', private_notes: '' });
    setModal('update');
  };

  const closeModal = () => {
    if (isSaving) return;
    setModal(null);
    setPrivatePhotoPreviewUrl(null);
    setError(null);
  };

  const saveStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    if (!studentDraft.first_name?.trim()) {
      setError('Enter the student’s first name.');
      return;
    }
    if (studentDraft.is_published && !canPublish) {
      setError('Your role cannot publish student profiles. Ask a Programs / Child Support lead to publish this profile.');
      return;
    }
    if (photo && !studentDraft.is_published) {
      setError('Select Publish profile before uploading a public profile photo.');
      return;
    }
    setIsSaving(true);
    setError(null);
    const payload = {
      first_name: studentDraft.first_name.trim(),
      last_name: studentDraft.last_name?.trim() || null,
      school_name: studentDraft.school_name?.trim() || null,
      grade_level: studentDraft.grade_level?.trim() || null,
      enrollment_status: studentDraft.enrollment_status || 'unknown',
      status: studentDraft.status || 'active',
    };
    const query = studentDraft.id
      ? client.from('children').update(payload).eq('id', studentDraft.id).select('id').single()
      : client.from('children').insert(payload).select('id').single();
    const { data, error: saveError } = await query;
    if (saveError) {
      setError(`Student could not be saved: ${saveError.message}`);
      setIsSaving(false);
      return;
    }
    const profileName = studentDraft.profile_display_name?.trim()
      || `${studentDraft.first_name.trim()} ${studentDraft.last_name?.trim() ?? ''}`.trim();
    const { data: savedProfile, error: profileLoadError } = await client.from('student_public_profiles')
      .select('id, slug, profile_photo_url, is_published, private_photo_path')
      .eq('child_id', data.id)
      .maybeSingle();
    if (profileLoadError) {
      setError(`Student details were saved, but the profile could not be loaded: ${profileLoadError.message}`);
      await refresh();
      setIsSaving(false);
      return;
    }
    const oldPhotoUrl = savedProfile?.profile_photo_url ?? null;
    let privatePhotoPath = savedProfile?.private_photo_path ?? null;
    if (photo) {
      try {
        privatePhotoPath = await uploadPrivateStudentPhoto(client, savedProfile?.id ?? data.id, photo);
      } catch (uploadError) {
        setError(`Student details were saved, but the private photo could not be uploaded: ${getErrorMessage(uploadError)}`);
        await refresh();
        setIsSaving(false);
        return;
      }
    } else if (!studentDraft.is_published && savedProfile?.is_published && oldPhotoUrl && !privatePhotoPath) {
      try {
        const oldPhotoPath = publicPhotoObjectPath(oldPhotoUrl);
        if (!oldPhotoPath) throw new Error('The saved photo is not in the expected public media bucket.');
        const { data: oldPhoto, error: downloadError } = await client.storage.from('hos-public').download(oldPhotoPath);
        if (downloadError) throw new Error(downloadError.message);
        privatePhotoPath = await uploadPrivateStudentPhoto(
          client,
          savedProfile.id,
          new File([oldPhoto], 'student-profile-photo', { type: oldPhoto.type || 'image/jpeg' }),
        );
      } catch (copyError) {
        setError(`Student details were saved, but the published photo could not be kept as a private draft: ${getErrorMessage(copyError)}`);
        await refresh();
        setIsSaving(false);
        return;
      }
    }
    const profilePayload = {
      child_id: data.id,
      slug: savedProfile?.slug || `${makeSlug(studentDraft.profile_slug || profileName) || 'student'}-${data.id.slice(0, 8)}`,
      display_name: profileName,
      profile_photo_url: studentDraft.is_published ? oldPhotoUrl : null,
      public_bio: studentDraft.public_bio?.trim() || null,
      school_stage: studentDraft.school_stage?.trim() || null,
      family_display_name: studentDraft.family_display_name?.trim() || null,
      family_district: studentDraft.family_district?.trim() || null,
      is_published: Boolean(studentDraft.is_published),
      private_photo_path: privatePhotoPath,
    };
    const { data: profileRecord, error: profileSaveError } = await client.from('student_public_profiles')
      .upsert(profilePayload, { onConflict: 'child_id' })
      .select('id')
      .single();
    if (profileSaveError) {
      let cleanupWarning = '';
      if (privatePhotoPath && privatePhotoPath !== savedProfile?.private_photo_path) {
        try {
          await removePrivateStudentPhoto(client, privatePhotoPath);
        } catch (cleanupError) {
          cleanupWarning = ` The private photo could not be cleaned up: ${getErrorMessage(cleanupError)}`;
        }
      }
      setError(`Student details were saved, but the profile could not be updated: ${profileSaveError.message}${cleanupWarning}`);
      await refresh();
      setIsSaving(false);
      return;
    }
    let nextPhotoUrl = studentDraft.is_published ? oldPhotoUrl : null;
    if (studentDraft.is_published && privatePhotoPath && (photo || !oldPhotoUrl)) {
      let uploadedPhotoUrl: string;
      try {
        const publicPhoto = photo ?? await downloadPrivateStudentPhoto(client, privatePhotoPath);
        uploadedPhotoUrl = await uploadPublicImage(publicPhoto, `student-profiles/${profileRecord.id}`);
      } catch (uploadError) {
        const { error: restoreError } = await client.from('student_public_profiles')
          .update({
            is_published: Boolean(savedProfile?.is_published),
            profile_photo_url: oldPhotoUrl,
            private_photo_path: privatePhotoPath,
          })
          .eq('child_id', data.id);
        setError(`Student details and the private photo were saved, but the public photo could not be uploaded: ${getErrorMessage(uploadError)}${restoreError ? ` The previous publication state could not be restored: ${restoreError.message}` : ''}`);
        await refresh();
        setIsSaving(false);
        return;
      }
      const { error: photoUpdateError } = await client.from('student_public_profiles')
        .update({ profile_photo_url: uploadedPhotoUrl })
        .eq('child_id', data.id);
      if (photoUpdateError) {
        const uploadedPath = publicPhotoObjectPath(uploadedPhotoUrl);
        const cleanup = uploadedPath ? await client.storage.from('hos-public').remove([uploadedPath]) : { error: null };
        const { error: restoreError } = await client.from('student_public_profiles')
          .update({
            is_published: Boolean(savedProfile?.is_published),
            profile_photo_url: oldPhotoUrl,
            private_photo_path: privatePhotoPath,
          })
          .eq('child_id', data.id);
        setError(`Student details were saved, but the photo could not be attached: ${photoUpdateError.message}${cleanup.error ? ` The uploaded file could not be removed: ${cleanup.error.message}` : ''}${restoreError ? ` The previous profile could not be restored: ${restoreError.message}` : ''}`);
        await refresh();
        setIsSaving(false);
        return;
      }
      nextPhotoUrl = uploadedPhotoUrl;
    }
    if (oldPhotoUrl && oldPhotoUrl !== nextPhotoUrl) {
      try {
        await removePublicPhoto(client, oldPhotoUrl);
      } catch (removeError) {
        setError(`Student details were saved, but the previous public photo could not be removed: ${getErrorMessage(removeError)}`);
        await refresh();
        setSelectedId(data.id);
        setIsSaving(false);
        return;
      }
    }
    if (savedProfile?.private_photo_path && savedProfile.private_photo_path !== privatePhotoPath) {
      try {
        await removePrivateStudentPhoto(client, savedProfile.private_photo_path);
      } catch (removeError) {
        setError(`The new photo was saved, but the previous private photo could not be removed: ${getErrorMessage(removeError)}`);
        await refresh();
        setSelectedId(data.id);
        setIsSaving(false);
        return;
      }
    }
    await refresh();
    setSelectedId(data.id);
    setModal(null);
    setIsSaving(false);
  };

  const saveUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    if (!selectedStudent || !supportDraft.title?.trim()) {
      setError('Add a clear title for this support update.');
      return;
    }
    setIsSaving(true);
    setError(null);
    const payload = {
      child_id: selectedStudent.id,
      occurred_on: supportDraft.occurred_on || currentDate(),
      category: supportDraft.category || 'other',
      title: supportDraft.title.trim(),
      private_notes: supportDraft.private_notes?.trim() || null,
      public_summary: null,
      is_public: false,
      created_by: user?.id ?? null,
    };
    const saveResult = supportDraft.id
      ? await client.from('student_support_updates').update(payload).eq('id', supportDraft.id)
      : await client.from('student_support_updates').insert(payload);
    const saveError = saveResult.error;
    if (saveError) {
      setError(`Support update could not be saved: ${saveError.message}`);
      setIsSaving(false);
      return;
    }
    await refresh();
    setModal(null);
    setIsSaving(false);
  };

  const deleteStudent = async (student: Student) => {
    if (readOnly) return;
    setIsSaving(true);
    setError(null);
    const profile = profiles.find((item) => item.child_id === student.id);
    const profilePhotoUrl = profile?.profile_photo_url;
    try {
      const { error: deleteError } = await client.from('children').delete().eq('id', student.id);
      if (deleteError) throw new Error(`Student could not be deleted: ${deleteError.message}`);

      setStudents((current) => current.filter((item) => item.id !== student.id));
      setProfiles((current) => current.filter((profile) => profile.child_id !== student.id));
      setUpdates((current) => current.filter((update) => update.child_id !== student.id));
      setAssistance((current) => current.map((item) => item.child_id === student.id ? { ...item, child_id: null } : item));
      setSelectedId((current) => current === student.id ? null : current);
      setConfirmDeleteId(null);

      let cleanupWarning: string | null = null;
      if (profilePhotoUrl) {
        try {
          await removePublicPhoto(client, profilePhotoUrl);
        } catch (cleanupError) {
          cleanupWarning = `Student deleted, but their public photo could not be removed: ${getErrorMessage(cleanupError)}`;
        }
      }
      if (profile?.private_photo_path) {
        try {
          await removePrivateStudentPhoto(client, profile.private_photo_path);
        } catch (cleanupError) {
          cleanupWarning = [cleanupWarning, `Student deleted, but their private profile photo could not be removed: ${getErrorMessage(cleanupError)}`]
            .filter(Boolean)
            .join(' ');
        }
      }

      try {
        await refresh();
      } catch (refreshError) {
        cleanupWarning = [cleanupWarning, `Student deleted, but the list could not be refreshed: ${getErrorMessage(refreshError)}`]
          .filter(Boolean)
          .join(' ');
      }
      if (cleanupWarning) setError(cleanupWarning);
    } catch (deleteError) {
      setError(getErrorMessage(deleteError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="student-workspace">
      {selectedStudent ? (
        <>
          <div className="student-workspace-heading">
            <button type="button" className="workspace-back-link" onClick={() => setSelectedId(null)}><ArrowLeft size={14} /> All students</button>
            <div className="student-workspace-title-row">
              <div><span className="eyebrow">Student support record</span><h2>{selectedStudent.first_name} {selectedStudent.last_name}</h2><p>{selectedStudent.school_name || 'School not recorded'}{selectedStudent.grade_level ? ` · ${selectedStudent.grade_level}` : ''}</p></div>
              {!readOnly && <div className="student-workspace-actions"><button className="button button-outline" type="button" onClick={() => openStudentForm(selectedStudent)}><Pencil size={14} /> Edit student &amp; profile</button><button className="button button-primary" type="button" onClick={() => openUpdateForm()}><Plus size={15} /> Log support</button></div>}
            </div>
          </div>
          {error && !modal && <div role="alert" className="form-message error">{error}</div>}
          <div className="student-detail-grid">
            <article className="panel student-detail-card">
              <div className="student-detail-portrait">{selectedProfile?.profile_photo_url ? <img src={selectedProfile.profile_photo_url} alt="" /> : <span className="student-avatar-initials">{getStudentInitials(`${selectedStudent.first_name} ${selectedStudent.last_name ?? ''}`)}</span>}</div>
              <h3>{selectedStudent.first_name} {selectedStudent.last_name}</h3>
              {(selectedProfile?.family_display_name || selectedProfile?.family_district) && <p>{[selectedProfile.family_display_name, selectedProfile.family_district].filter(Boolean).join(' · ')}</p>}
              <div className="student-detail-facts">
                <span><strong>School</strong>{selectedStudent.school_name || 'Not recorded'}</span>
                <span><strong>Grade</strong>{selectedStudent.grade_level || 'Not recorded'}</span>
                <span><strong>Enrollment</strong>{selectedStudent.enrollment_status.replaceAll('_', ' ')}</span>
                <span><strong>Student status</strong>{selectedStudent.status}</span>
              </div>
              {readOnly
                ? <span className={`student-public-status${selectedProfile?.is_published ? ' published' : ''}`}><span className="status-dot" />{selectedProfile?.is_published ? 'Published' : 'Private'}</span>
                : <button
                  type="button"
                  className={`student-public-status student-publication-action${selectedProfile?.is_published ? ' published' : ''}`}
                  onClick={() => openStudentForm(selectedStudent)}
                  aria-label={selectedProfile?.is_published ? 'Edit or unpublish public student profile' : 'Prepare or publish student profile'}
                >
                  <span className="status-dot" />{selectedProfile?.is_published ? 'Published · edit or unpublish' : 'Private · prepare or publish'}
                </button>}
              <span className={`student-status-badge${selectedStudent.status === 'active' ? ' active' : ''}`}>
                {selectedStudent.status === 'active' ? 'Active' : selectedStudent.status === 'inactive' ? 'Inactive' : selectedStudent.status}
              </span>
              <p className="field-hint">Only the profile fields and milestones specifically approved for sharing appear on the public website.</p>
            </article>
            <article className="panel student-timeline-panel">
              <div className="panel-heading"><div><h3>Support journey</h3><p>{timeline.length} recorded milestone{timeline.length === 1 ? '' : 's'}</p></div><button className="icon-button" type="button" onClick={() => void refresh().catch((loadError: unknown) => setError(getErrorMessage(loadError)))} aria-label="Refresh support history"><RefreshCw size={15} /></button></div>
              {timeline.length ? <ol className="student-staff-timeline">{timeline.map((item) => (
                <li key={`${item.category}-${item.id}`}><span className="student-timeline-dot" /><div><div className="student-timeline-meta"><span>{item.category.replaceAll('_', ' ')}</span><time>{item.date ? new Date(item.date).toLocaleDateString('en', { dateStyle: 'medium', timeZone: 'Africa/Kigali' }) : 'Date not recorded'}</time>{!readOnly && item.source === 'update' && <button className="student-update-edit" type="button" onClick={() => openUpdateForm(updates.find((update) => update.id === item.id))}>Edit</button>}</div><h4>{item.title}</h4>{item.detail && <p>{item.detail}</p>}</div></li>
              ))}</ol> : <div className="student-empty-state compact"><HeartHandshake size={22} /><p>Support milestones and assistance records will appear here as the team records them.</p></div>}
            </article>
          </div>
        </>
      ) : (
        <>
          <div className="student-workspace-heading">
            <div className="student-workspace-title-row"><div><span className="eyebrow">{readOnly ? 'Read-only student records' : 'One student at a time'}</span><h2>Student support</h2><p>Keep each student’s profile, family context, and support journey together.</p></div>{!readOnly && <button className="button button-primary" type="button" onClick={() => openStudentForm()}><Plus size={15} /> Add student</button>}</div>
            <div className="student-workspace-toolbar"><label className="student-search"><Search size={16} /><span className="sr-only">Search students</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students or schools" /></label><span className="student-count">{students.length} student{students.length === 1 ? '' : 's'}</span></div>
          </div>
          {error && <div role="alert" className="form-message error">{error}</div>}
          {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading student records…</div>
            : filteredStudents.length ? <div className="student-staff-grid">{filteredStudents.map((student) => {
              const profile = profiles.find((entry) => entry.child_id === student.id);
              const count = updates.filter((item) => item.child_id === student.id).length + assistance.filter((item) => item.child_id === student.id).length;
              const studentName = `${student.first_name} ${student.last_name ?? ''}`.trim();
              return <div className="student-staff-card-row" key={student.id}>
                <button className="student-staff-card" type="button" onClick={() => setSelectedId(student.id)}>
                  <span className="student-staff-avatar">{profile?.profile_photo_url ? <img src={profile.profile_photo_url} alt="" /> : <span className="student-avatar-initials">{getStudentInitials(studentName)}</span>}</span>
                  <span className="student-staff-card-copy"><strong>{studentName}</strong><span>{student.school_name || 'School not recorded'}</span><small>{count} support record{count === 1 ? '' : 's'}</small><span className="student-status-badges"><span className={`student-status-badge${student.status === 'active' ? ' active' : ''}`}>{student.status === 'active' ? 'Active' : student.status === 'inactive' ? 'Inactive' : student.status}</span><span className={`student-status-badge${profile?.is_published ? ' published' : ''}`}>{profile?.is_published ? 'Published' : 'Private'}</span></span></span><ArrowRight size={17} />
                </button>
                {!readOnly && <div className="student-staff-card-actions">
                  <button
                    className="button button-danger button-small student-card-delete-trigger"
                    type="button"
                    aria-label={`Delete ${studentName}`}
                    title={`Delete ${studentName}`}
                    disabled={isSaving}
                    onClick={() => setConfirmDeleteId(student.id)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>}
              </div>;
            })}</div>
              : <div className="student-empty-state"><GraduationCap size={26} /><h3>{students.length ? 'No students match your search' : readOnly ? 'No student records available' : 'Start with a student record'}</h3><p>{students.length ? 'Try another name or school.' : readOnly ? 'Student records will appear here when available.' : 'Add a student to create a secure profile and record their support over time.'}</p>{!readOnly && !students.length && <button className="button button-primary" type="button" onClick={() => openStudentForm()}><Plus size={15} /> Add first student</button>}</div>}
        </>
      )}

      {!readOnly && confirmingStudent && !selectedStudent && <div className="modal-backdrop confirm-action-backdrop student-delete-backdrop" role="presentation" onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) setConfirmDeleteId(null);
      }}>
        <section className="modal confirm-action-dialog student-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="student-delete-title" aria-describedby="student-delete-message">
          <div className="modal-header"><h2 id="student-delete-title">Delete {confirmingStudent.first_name} {confirmingStudent.last_name}?</h2><button className="icon-button" type="button" disabled={isSaving} onClick={() => setConfirmDeleteId(null)} aria-label="Close confirmation"><X size={16} /></button></div>
          <div className="modal-body">
            <p id="student-delete-message">This permanently deletes the student, public profile, and support milestones. The family record stays; assistance and case history are kept but unlinked.</p>
            <div className="record-form-actions">
              <button type="button" className="button button-outline" disabled={isSaving} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button type="button" className="button button-danger" disabled={isSaving} onClick={() => void deleteStudent(confirmingStudent)}>{isSaving ? 'Deleting…' : 'Delete student'}</button>
            </div>
          </div>
        </section>
      </div>}

      {!readOnly && modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <div className="modal modal-wide student-workspace-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
          <div className="modal-header"><div><div className="eyebrow">Student support</div><h2 id="student-modal-title">{modal === 'student' ? studentDraft.id ? 'Edit student & profile' : 'Add a student' : supportDraft.id ? 'Edit support milestone' : 'Record a support milestone'}</h2></div><button className="icon-button" type="button" onClick={closeModal} disabled={isSaving} aria-label="Close"><X size={17} /></button></div>
          <div className="modal-body">
            {modal === 'student' && <form className="form-grid" onSubmit={(event) => void saveStudent(event)}>
              <label className="field"><span className="field-label">First name *</span><input className="input" required value={studentDraft.first_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, first_name: event.target.value })} /></label>
              <label className="field"><span className="field-label">Last name</span><input className="input" value={studentDraft.last_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, last_name: event.target.value })} /></label>
              <label className="field"><span className="field-label">School</span><input className="input" value={studentDraft.school_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, school_name: event.target.value })} /></label>
              <label className="field"><span className="field-label">Grade / level</span><select className="select" value={studentDraft.grade_level ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, grade_level: event.target.value })}><option value="">Choose grade / level</option>{gradeLevels.map((level) => <option key={level} value={level}>{level}</option>)}{studentDraft.grade_level && !gradeLevels.includes(studentDraft.grade_level) && <option value={studentDraft.grade_level}>{studentDraft.grade_level}</option>}</select></label>
              <label className="field"><span className="field-label">Enrollment</span><select className="select" value={studentDraft.enrollment_status ?? 'unknown'} onChange={(event) => setStudentDraft({ ...studentDraft, enrollment_status: event.target.value })}>{['unknown', 'enrolled', 'not_enrolled', 'graduated'].map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>
              <label className="field"><span className="field-label">Status</span><select className="select" value={studentDraft.status ?? 'active'} onChange={(event) => setStudentDraft({ ...studentDraft, status: event.target.value })}>{['active', 'inactive', 'closed'].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <div className="student-public-form-section field-span"><div><span className="eyebrow">Public profile · published by default</span><h3>Profile details</h3><p>Only add a family display name or district when it is approved for public sharing. Never enter phone numbers, addresses, health details, or safeguarding information here.</p></div>
                <label className="field"><span className="field-label">Public display name</span><input className="input" maxLength={100} value={studentDraft.profile_display_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, profile_display_name: event.target.value })} placeholder={`${studentDraft.first_name ?? ''} ${studentDraft.last_name ?? ''}`.trim() || 'Use an approved name'} /><span className="field-hint">If left blank, the student’s name above is used.</span></label>
                <label className="field"><span className="field-label">School stage (optional)</span><select className="select" value={studentDraft.school_stage ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, school_stage: event.target.value })}><option value="">Choose school stage</option>{schoolStages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}{studentDraft.school_stage && !schoolStages.includes(studentDraft.school_stage) && <option value={studentDraft.school_stage}>{studentDraft.school_stage}</option>}</select></label>
                <label className="field"><span className="field-label">Family / guardian display name (optional)</span><input className="input" maxLength={100} value={studentDraft.family_display_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, family_display_name: event.target.value })} placeholder="Name approved for public display" /></label>
                <label className="field"><span className="field-label">Family district (optional)</span><select className="select" value={studentDraft.family_district ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, family_district: event.target.value })}><option value="">Choose district</option>{rwandaDistricts.map((district) => <option key={district} value={district}>{district}</option>)}{studentDraft.family_district && !rwandaDistricts.includes(studentDraft.family_district) && <option value={studentDraft.family_district}>{studentDraft.family_district}</option>}</select></label>
                <label className="field field-span"><span className="field-label">Student background and story</span><textarea className="textarea" maxLength={500} value={studentDraft.public_bio ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, public_bio: event.target.value })} placeholder="A short, respectful introduction about the student and their journey" /></label>
                <label className="field"><span className="field-label">Profile photo</span><span className="image-upload-button"><ImageUp size={15} />{photo?.name || (studentDraft.profile_photo_url || studentDraft.private_photo_path ? 'Choose a new photo' : 'Choose photo')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></span><span className="field-hint">JPEG, PNG, WebP or AVIF; maximum 5 MB. A photo saved while private is kept in secure staff-only storage until you publish.</span></label>
                {studentDraft.profile_photo_url && !photo && <div className="student-form-photo"><img src={studentDraft.profile_photo_url} alt="Current profile photo preview" /></div>}
                {studentDraft.private_photo_path && !studentDraft.profile_photo_url && !photo && privatePhotoPreviewUrl && <div className="student-form-photo"><img src={privatePhotoPreviewUrl} alt="Private student photo preview" /><span className="field-hint">Saved privately — not visible on the public website.</span></div>}
                {!studentDraft.profile_photo_url && !privatePhotoPreviewUrl && !photo && <div className="student-form-photo"><span className="student-form-avatar student-avatar-initials">{getStudentInitials(`${studentDraft.profile_display_name || studentDraft.first_name || ''} ${studentDraft.last_name ?? ''}`)}</span></div>}
                <fieldset className="student-publish-control field-span">
                  <legend>Should this profile appear on the public website?</legend>
                  <p>New profiles are public by default. Keep this private if the name or details are not approved for sharing.</p>
                  <div className="student-publish-options">
                    <label className={`student-publish-option${!studentDraft.is_published ? ' selected' : ''}`}>
                      <input
                        type="radio"
                        name="student-publication"
                        checked={!studentDraft.is_published}
                        disabled={!canPublish}
                        onChange={() => { setStudentDraft({ ...studentDraft, is_published: false }); setPhoto(null); }}
                      />
                      <span><strong>No — keep private</strong><small>Save this student for staff only. You can publish later.</small></span>
                    </label>
                    <label className={`student-publish-option${studentDraft.is_published ? ' selected' : ''}`}>
                      <input
                        type="radio"
                        name="student-publication"
                        checked={Boolean(studentDraft.is_published)}
                        disabled={!canPublish}
                        onChange={() => setStudentDraft({ ...studentDraft, is_published: true })}
                      />
                      <span><strong>Yes — publish profile</strong><small>Show these approved details on the student directory.</small></span>
                    </label>
                  </div>
                  {!canPublish && <span className="field-hint">Your role cannot change publication. Ask an authorized Child Support team member.</span>}
                </fieldset>
              </div>
              <p className="field-hint field-span">Existing private profiles stay private. Family display name and district are shown publicly only while this profile is published.</p>
              {error && <div role="alert" className="form-message error field-span">{error}</div>}
              <div className="form-actions field-span"><button className="button button-outline" type="button" onClick={closeModal} disabled={isSaving}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : studentDraft.is_published ? 'Save & publish profile' : 'Save student record'}</button></div>
            </form>}
            {modal === 'update' && <form className="form-grid" onSubmit={(event) => void saveUpdate(event)}>
              <label className="field"><span className="field-label">Date *</span><input className="input" type="date" required value={supportDraft.occurred_on ?? currentDate()} onChange={(event) => setSupportDraft({ ...supportDraft, occurred_on: event.target.value })} /></label>
              <label className="field"><span className="field-label">Area *</span><select className="select" value={supportDraft.category ?? 'education'} onChange={(event) => setSupportDraft({ ...supportDraft, category: event.target.value })}>{categories.map((category) => <option value={category} key={category}>{category.replaceAll('_', ' ')}</option>)}</select></label>
              <label className="field field-span"><span className="field-label">Milestone title *</span><input className="input" required maxLength={140} value={supportDraft.title ?? ''} onChange={(event) => setSupportDraft({ ...supportDraft, title: event.target.value })} placeholder="For example, completed the school term" /></label>
              <label className="field field-span"><span className="field-label">Private staff notes</span><textarea className="textarea" value={supportDraft.private_notes ?? ''} onChange={(event) => setSupportDraft({ ...supportDraft, private_notes: event.target.value })} placeholder="Internal follow-up notes. Do not copy these to public summaries." /></label>
              <p className="field-hint field-span">Support history is visible only to authorized staff and is never published on the public profile.</p>
              {error && <div role="alert" className="form-message error field-span">{error}</div>}
              <div className="form-actions field-span"><button className="button button-outline" type="button" onClick={closeModal} disabled={isSaving}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save support update'}</button></div>
            </form>}
          </div>
        </div>
      </div>}
    </section>
  );
}
