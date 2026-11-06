import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, HeartHandshake, ImageUp, Pencil, Plus, RefreshCw, Search, UsersRound, X } from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { listAdminRows, uploadPublicImage } from '../lib/admin-api';
import { getSupabaseClient } from '../lib/supabase';

type Student = {
  id: string;
  family_id: string;
  child_code: string | null;
  first_name: string;
  last_name: string | null;
  date_of_birth: string | null;
  gender: string | null;
  school_name: string | null;
  grade_level: string | null;
  enrollment_status: string;
  status: string;
  public_bio?: string | null;
  profile_display_name?: string;
  profile_slug?: string;
  profile_photo_url?: string | null;
  school_stage?: string | null;
  is_published?: boolean;
};

type Family = { id: string; household_code: string | null; primary_contact_name: string };
type StudentProfile = {
  id: string;
  child_id: string;
  slug: string;
  display_name: string;
  profile_photo_url: string | null;
  public_bio: string | null;
  school_stage: string | null;
  is_published: boolean;
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
type Modal = 'student' | 'update' | 'family' | null;

const categories = ['education', 'nutrition', 'health', 'family', 'mentorship', 'other'];
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

export function StudentSupportWorkspace({ roles }: { roles: string[] }) {
  const { user } = useAuth();
  const client = getSupabaseClient();
  const canPublish = roles.some((role) => ['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition'].includes(role));
  const [students, setStudents] = useState<Student[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
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
  const [familyDraft, setFamilyDraft] = useState({ primary_contact_name: '', household_code: '', district: '' });
  const [supportDraft, setSupportDraft] = useState<Partial<SupportUpdate>>({});
  const [photo, setPhoto] = useState<File | null>(null);

  const refresh = useCallback(async () => {
    const [childrenResult, familiesResult, profilesResult, updatesResult, assistanceResult] = await Promise.all([
      client.from('children').select('id, family_id, child_code, first_name, last_name, date_of_birth, gender, school_name, grade_level, enrollment_status, status').neq('status', 'closed').order('first_name'),
      client.from('families').select('id, household_code, primary_contact_name').neq('status', 'closed').order('primary_contact_name'),
      client.from('student_public_profiles').select('id, child_id, slug, display_name, profile_photo_url, public_bio, school_stage, is_published'),
      client.from('student_support_updates').select('id, child_id, occurred_on, category, title, private_notes').order('occurred_on', { ascending: false }),
      listAdminRows('assistance_records'),
    ]);
    const loadError = childrenResult.error ?? familiesResult.error ?? profilesResult.error ?? updatesResult.error;
    if (loadError) throw new Error(`Student workspace could not be loaded: ${loadError.message}`);
    setStudents(childrenResult.data ?? []);
    setFamilies(familiesResult.data ?? []);
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

  const selectedStudent = students.find((student) => student.id === selectedId) ?? null;
  const selectedProfile = profiles.find((profile) => profile.child_id === selectedId) ?? null;
  const filteredStudents = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return students.filter((student) => `${student.first_name} ${student.last_name ?? ''} ${student.child_code ?? ''} ${student.school_name ?? ''}`.toLocaleLowerCase().includes(term));
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
    const profile = student ? profiles.find((item) => item.child_id === student.id) : null;
    setStudentDraft(student
      ? {
          ...student,
          public_bio: profile?.public_bio ?? '',
          profile_display_name: profile?.display_name ?? `${student.first_name} ${student.last_name ?? ''}`.trim(),
          profile_slug: profile?.slug ?? '',
          profile_photo_url: profile?.profile_photo_url ?? null,
          school_stage: profile?.school_stage ?? '',
          is_published: profile?.is_published ?? false,
        }
      : { family_id: '', first_name: '', last_name: '', child_code: '', date_of_birth: '', gender: 'undisclosed', school_name: '', grade_level: '', enrollment_status: 'unknown', status: 'active', public_bio: '', profile_display_name: '', profile_slug: '', profile_photo_url: null, school_stage: '', is_published: false });
    setPhoto(null);
    setModal('student');
  };
  const openUpdateForm = (update?: SupportUpdate) => {
    if (!selectedStudent) return;
    setSupportDraft(update
      ? { ...update }
      : { child_id: selectedStudent.id, occurred_on: currentDate(), category: 'education', title: '', private_notes: '' });
    setModal('update');
  };

  const closeModal = () => {
    if (isSaving) return;
    setModal(null);
    setError(null);
  };

  const saveStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!studentDraft.family_id || !studentDraft.first_name?.trim()) {
      setError('Choose a family and enter the student’s first name.');
      return;
    }
    if (studentDraft.is_published && !studentDraft.profile_display_name?.trim()) {
      setError('Add a public display name before publishing this profile.');
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
      family_id: studentDraft.family_id,
      child_code: studentDraft.child_code || null,
      first_name: studentDraft.first_name.trim(),
      last_name: studentDraft.last_name?.trim() || null,
      date_of_birth: studentDraft.date_of_birth || null,
      gender: studentDraft.gender || 'undisclosed',
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
      .select('id, slug, profile_photo_url, is_published')
      .eq('child_id', data.id)
      .maybeSingle();
    if (profileLoadError) {
      setError(`Student details were saved, but the profile could not be loaded: ${profileLoadError.message}`);
      await refresh();
      setIsSaving(false);
      return;
    }
    const oldPhotoUrl = savedProfile?.profile_photo_url ?? null;
    const profilePayload = {
      child_id: data.id,
      slug: savedProfile?.slug || `${makeSlug(studentDraft.profile_slug || profileName) || 'student'}-${data.id.slice(0, 8)}`,
      display_name: profileName,
      profile_photo_url: studentDraft.is_published ? oldPhotoUrl : null,
      public_bio: studentDraft.public_bio?.trim() || null,
      school_stage: studentDraft.school_stage?.trim() || null,
      is_published: Boolean(studentDraft.is_published),
    };
    const { data: profileRecord, error: profileSaveError } = await client.from('student_public_profiles')
      .upsert(profilePayload, { onConflict: 'child_id' })
      .select('id')
      .single();
    if (profileSaveError) {
      setError(`Student details were saved, but the profile could not be updated: ${profileSaveError.message}`);
      await refresh();
      setIsSaving(false);
      return;
    }
    if (photo) {
      let uploadedPhotoUrl: string;
      try {
        uploadedPhotoUrl = await uploadPublicImage(photo, `student-profiles/${profileRecord.id}`);
      } catch (uploadError) {
        const { error: restoreError } = await client.from('student_public_profiles')
          .update({ is_published: Boolean(savedProfile?.is_published) })
          .eq('child_id', data.id);
        setError(`Student details were saved, but the profile photo could not be uploaded: ${getErrorMessage(uploadError)}${restoreError ? ` The previous publication state could not be restored: ${restoreError.message}` : ''}`);
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
          .update({ is_published: Boolean(savedProfile?.is_published), profile_photo_url: oldPhotoUrl })
          .eq('child_id', data.id);
        setError(`Student details were saved, but the photo could not be attached: ${photoUpdateError.message}${cleanup.error ? ` The uploaded file could not be removed: ${cleanup.error.message}` : ''}${restoreError ? ` The previous profile could not be restored: ${restoreError.message}` : ''}`);
        await refresh();
        setIsSaving(false);
        return;
      }
      if (oldPhotoUrl && oldPhotoUrl !== uploadedPhotoUrl) {
        try {
          await removePublicPhoto(client, oldPhotoUrl);
        } catch (removeError) {
          setError(`The new photo is live, but the previous photo could not be removed: ${getErrorMessage(removeError)}`);
          await refresh();
          setSelectedId(data.id);
          setIsSaving(false);
          return;
        }
      }
    }
    if (!studentDraft.is_published && oldPhotoUrl) {
      try {
        await removePublicPhoto(client, oldPhotoUrl);
      } catch (removeError) {
        setError(`Student details were saved and the profile is private, but the old public photo could not be removed: ${getErrorMessage(removeError)}`);
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

  const saveFamily = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!familyDraft.primary_contact_name.trim()) {
      setError('Enter the family’s primary contact name.');
      return;
    }
    setIsSaving(true);
    setError(null);
    const { data, error: saveError } = await client.from('families').insert({
      primary_contact_name: familyDraft.primary_contact_name.trim(),
      household_code: familyDraft.household_code.trim() || null,
      district: familyDraft.district.trim() || null,
      status: 'active',
    }).select('id').single();
    if (saveError) {
      setError(`Family record could not be saved: ${saveError.message}`);
      setIsSaving(false);
      return;
    }
    await refresh();
    setStudentDraft((current) => ({ ...current, family_id: data.id }));
    setModal('student');
    setIsSaving(false);
  };

  const saveUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

  return (
    <section className="student-workspace">
      {selectedStudent ? (
        <>
          <div className="student-workspace-heading">
            <button type="button" className="workspace-back-link" onClick={() => setSelectedId(null)}><ArrowLeft size={14} /> All students</button>
            <div className="student-workspace-title-row">
              <div><span className="eyebrow">Student support record</span><h2>{selectedStudent.first_name} {selectedStudent.last_name}</h2><p>{selectedStudent.child_code || 'No student code'} · {selectedStudent.school_name || 'School not recorded'}{selectedStudent.grade_level ? ` · ${selectedStudent.grade_level}` : ''}</p></div>
              <div className="student-workspace-actions"><button className="button button-outline" type="button" onClick={() => openStudentForm(selectedStudent)}><Pencil size={14} /> Edit student &amp; profile</button><button className="button button-primary" type="button" onClick={() => openUpdateForm()}><Plus size={15} /> Log support</button></div>
            </div>
          </div>
          {error && !modal && <div role="alert" className="form-message error">{error}</div>}
          <div className="student-detail-grid">
            <article className="panel student-detail-card">
              <div className="student-detail-portrait">{selectedProfile?.profile_photo_url ? <img src={selectedProfile.profile_photo_url} alt="" /> : <UsersRound size={32} />}</div>
              <h3>{selectedStudent.first_name} {selectedStudent.last_name}</h3>
              <p>{families.find((family) => family.id === selectedStudent.family_id)?.primary_contact_name || 'Family record'}</p>
              <div className="student-detail-facts">
                <span><strong>School</strong>{selectedStudent.school_name || 'Not recorded'}</span>
                <span><strong>Grade</strong>{selectedStudent.grade_level || 'Not recorded'}</span>
                <span><strong>Enrollment</strong>{selectedStudent.enrollment_status.replaceAll('_', ' ')}</span>
                <span><strong>Student status</strong>{selectedStudent.status}</span>
              </div>
              <div className={`student-public-status${selectedProfile?.is_published ? ' published' : ''}`}>
                <span className="status-dot" />{selectedProfile?.is_published ? 'Public profile published' : 'Private staff record'}
              </div>
              <p className="field-hint">Only the profile fields and milestones specifically approved for sharing appear on the public website.</p>
            </article>
            <article className="panel student-timeline-panel">
              <div className="panel-heading"><div><h3>Support journey</h3><p>{timeline.length} recorded milestone{timeline.length === 1 ? '' : 's'}</p></div><button className="icon-button" type="button" onClick={() => void refresh().catch((loadError: unknown) => setError(getErrorMessage(loadError)))} aria-label="Refresh support history"><RefreshCw size={15} /></button></div>
              {timeline.length ? <ol className="student-staff-timeline">{timeline.map((item) => (
                <li key={`${item.category}-${item.id}`}><span className="student-timeline-dot" /><div><div className="student-timeline-meta"><span>{item.category.replaceAll('_', ' ')}</span><time>{item.date ? new Date(item.date).toLocaleDateString('en', { dateStyle: 'medium', timeZone: 'Africa/Kigali' }) : 'Date not recorded'}</time>{item.source === 'update' && <button className="student-update-edit" type="button" onClick={() => openUpdateForm(updates.find((update) => update.id === item.id))}>Edit</button>}</div><h4>{item.title}</h4>{item.detail && <p>{item.detail}</p>}</div></li>
              ))}</ol> : <div className="student-empty-state compact"><HeartHandshake size={22} /><p>Support milestones and assistance records will appear here as the team records them.</p></div>}
            </article>
          </div>
        </>
      ) : (
        <>
          <div className="student-workspace-heading">
            <div className="student-workspace-title-row"><div><span className="eyebrow">One student at a time</span><h2>Student support</h2><p>Keep each student’s profile, family context, and support journey together.</p></div><button className="button button-primary" type="button" onClick={() => openStudentForm()}><Plus size={15} /> Add student</button></div>
            <div className="student-workspace-toolbar"><label className="student-search"><Search size={16} /><span className="sr-only">Search students</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students, codes, or schools" /></label><span className="student-count">{students.length} student{students.length === 1 ? '' : 's'}</span></div>
          </div>
          {error && <div role="alert" className="form-message error">{error}</div>}
          {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading student records…</div>
            : filteredStudents.length ? <div className="student-staff-grid">{filteredStudents.map((student) => {
              const profile = profiles.find((entry) => entry.child_id === student.id);
              const count = updates.filter((item) => item.child_id === student.id).length + assistance.filter((item) => item.child_id === student.id).length;
              return <button className="student-staff-card" type="button" key={student.id} onClick={() => setSelectedId(student.id)}>
                <span className="student-staff-avatar">{profile?.profile_photo_url ? <img src={profile.profile_photo_url} alt="" /> : <UsersRound size={25} />}</span>
                <span className="student-staff-card-copy"><strong>{student.first_name} {student.last_name}</strong><span>{student.child_code || 'No code'} · {student.school_name || 'School not recorded'}</span><small>{count} support record{count === 1 ? '' : 's'} · {profile?.is_published ? 'Profile public' : 'Private profile'}</small></span><ArrowRight size={17} />
              </button>;
            })}</div>
              : <div className="student-empty-state"><GraduationCap size={26} /><h3>{students.length ? 'No students match your search' : 'Start with a student record'}</h3><p>{students.length ? 'Try another name, student code, or school.' : 'Add a student to create a secure profile and record their support over time.'}</p>{!students.length && <button className="button button-primary" type="button" onClick={() => openStudentForm()}><Plus size={15} /> Add first student</button>}</div>}
        </>
      )}

      {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <div className="modal modal-wide student-workspace-modal" role="dialog" aria-modal="true" aria-labelledby="student-modal-title">
          <div className="modal-header"><div><div className="eyebrow">Student support</div><h2 id="student-modal-title">{modal === 'student' ? studentDraft.id ? 'Edit student & profile' : 'Add a student' : modal === 'update' ? supportDraft.id ? 'Edit support milestone' : 'Record a support milestone' : 'Add a family'}</h2></div><button className="icon-button" type="button" onClick={closeModal} disabled={isSaving} aria-label="Close"><X size={17} /></button></div>
          <div className="modal-body">
            {modal === 'student' && <form className="form-grid" onSubmit={(event) => void saveStudent(event)}>
              <label className="field field-span"><span className="field-label">Family record *</span><select className="select" required value={studentDraft.family_id ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, family_id: event.target.value })}><option value="">Choose family</option>{families.map((family) => <option value={family.id} key={family.id}>{family.primary_contact_name}{family.household_code ? ` · ${family.household_code}` : ''}</option>)}</select>{!families.length && <button className="text-button" type="button" onClick={() => { setFamilyDraft({ primary_contact_name: '', household_code: '', district: '' }); setModal('family'); }}>No family yet? Add a family record</button>}</label>
              <label className="field"><span className="field-label">First name *</span><input className="input" required value={studentDraft.first_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, first_name: event.target.value })} /></label>
              <label className="field"><span className="field-label">Last name</span><input className="input" value={studentDraft.last_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, last_name: event.target.value })} /></label>
              <label className="field"><span className="field-label">Student code</span><input className="input" value={studentDraft.child_code ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, child_code: event.target.value })} /></label>
              <label className="field"><span className="field-label">Date of birth (staff only)</span><input className="input" type="date" value={studentDraft.date_of_birth ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, date_of_birth: event.target.value })} /></label>
              <label className="field"><span className="field-label">School</span><input className="input" value={studentDraft.school_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, school_name: event.target.value })} /></label>
              <label className="field"><span className="field-label">Grade / level</span><input className="input" value={studentDraft.grade_level ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, grade_level: event.target.value })} /></label>
              <label className="field"><span className="field-label">Gender (staff only)</span><select className="select" value={studentDraft.gender ?? 'undisclosed'} onChange={(event) => setStudentDraft({ ...studentDraft, gender: event.target.value })}>{['undisclosed', 'female', 'male', 'other'].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="field"><span className="field-label">Enrollment</span><select className="select" value={studentDraft.enrollment_status ?? 'unknown'} onChange={(event) => setStudentDraft({ ...studentDraft, enrollment_status: event.target.value })}>{['unknown', 'enrolled', 'not_enrolled', 'graduated'].map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>
              <label className="field"><span className="field-label">Status</span><select className="select" value={studentDraft.status ?? 'active'} onChange={(event) => setStudentDraft({ ...studentDraft, status: event.target.value })}>{['active', 'inactive', 'closed'].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <div className="student-public-form-section field-span"><div><span className="eyebrow">Optional public profile</span><h3>Prepare the visitor-facing story</h3><p>Keep this short and respectful. Private family details, full birth dates, health information, and support status are never published.</p></div>
                <label className="field"><span className="field-label">Public display name</span><input className="input" maxLength={100} value={studentDraft.profile_display_name ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, profile_display_name: event.target.value })} placeholder="Use only a name approved for public display" /></label>
                <label className="field"><span className="field-label">School stage (optional)</span><input className="input" maxLength={80} value={studentDraft.school_stage ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, school_stage: event.target.value })} placeholder="For example, primary education" /></label>
                <label className="field field-span"><span className="field-label">Student background and story</span><textarea className="textarea" maxLength={500} value={studentDraft.public_bio ?? ''} onChange={(event) => setStudentDraft({ ...studentDraft, public_bio: event.target.value })} placeholder="A short, respectful introduction about the student and their journey" /></label>
                <label className="field"><span className="field-label">Profile photo</span><span className="image-upload-button"><ImageUp size={15} />{photo?.name || (studentDraft.profile_photo_url ? 'Choose a new photo' : 'Choose photo')}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={!studentDraft.is_published} onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} /></span><span className="field-hint">JPEG, PNG, WebP or AVIF; maximum 5 MB. A photo is uploaded only when the profile is published.</span></label>
                {studentDraft.profile_photo_url && !photo && <div className="student-form-photo"><img src={studentDraft.profile_photo_url} alt="Current profile photo preview" /></div>}
                <label className="checkbox-field field-span"><input type="checkbox" checked={Boolean(studentDraft.is_published)} onChange={(event) => { setStudentDraft({ ...studentDraft, is_published: event.target.checked }); if (!event.target.checked) setPhoto(null); }} /><span>Publish this profile on the public website. Check the display name, story, school stage, and photo before sharing.</span></label>
              </div>
              <p className="field-hint field-span">Date of birth, gender, family details, private notes, health, and individual support status stay in the protected staff record and are never included in the public profile.</p>
              {error && <div role="alert" className="form-message error field-span">{error}</div>}
              <div className="form-actions field-span"><button className="button button-outline" type="button" onClick={closeModal} disabled={isSaving}>Cancel</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : studentDraft.is_published ? 'Save & publish profile' : 'Save student record'}</button></div>
            </form>}
            {modal === 'family' && <form className="form-grid" onSubmit={(event) => void saveFamily(event)}>
              <label className="field field-span"><span className="field-label">Primary contact name *</span><input className="input" required value={familyDraft.primary_contact_name} onChange={(event) => setFamilyDraft({ ...familyDraft, primary_contact_name: event.target.value })} /></label>
              <label className="field"><span className="field-label">Household code</span><input className="input" value={familyDraft.household_code} onChange={(event) => setFamilyDraft({ ...familyDraft, household_code: event.target.value })} /></label>
              <label className="field"><span className="field-label">District</span><input className="input" value={familyDraft.district} onChange={(event) => setFamilyDraft({ ...familyDraft, district: event.target.value })} /></label>
              {error && <div role="alert" className="form-message error field-span">{error}</div>}
              <div className="form-actions field-span"><button className="button button-outline" type="button" onClick={() => setModal('student')}>Back</button><button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save family'}</button></div>
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
