import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, GraduationCap, HeartHandshake, Search, UsersRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

type PublicStudent = {
  slug: string;
  display_name: string;
  profile_photo_url: string | null;
  public_bio: string | null;
  school_stage: string | null;
};

function useStudentDirectory() {
  const [students, setStudents] = useState<PublicStudent[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(isSupabaseConfigured ? null : 'The student directory is not available right now.');
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const client = getSupabaseClient();
    let active = true;
    const load = async () => {
      const { data, error: loadError } = await client
        .from('public_student_profiles')
        .select('slug, display_name, profile_photo_url, public_bio, school_stage')
        .order('display_name');
      if (!active) return;
      if (loadError) {
        console.error('Public student profiles could not be loaded.', loadError);
        setError('Student profiles are temporarily unavailable. Please try again later.');
      } else {
        setStudents(data ?? []);
        setError(null);
      }
      setIsLoading(false);
    };

    void load();
    const channel = client
      .channel('public-student-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_directory_events' }, () => {
        void load();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setSyncWarning('Live directory updates are temporarily unavailable. Refresh the page to check for changes.');
        } else if (status === 'SUBSCRIBED') {
          setSyncWarning(null);
        }
      });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, []);

  return { students, isLoading, error, syncWarning };
}

export function StudentDirectoryPage() {
  const { students, isLoading, error, syncWarning } = useStudentDirectory();
  const [search, setSearch] = useState('');
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filteredStudents = useMemo(
    () => students.filter((student) => `${student.display_name} ${student.school_stage ?? ''}`.toLocaleLowerCase().includes(normalizedSearch)),
    [normalizedSearch, students],
  );

  return (
    <div className="student-public-page">
      <header className="student-directory-hero">
        <div className="wrap">
          <div className="eyebrow"><HeartHandshake size={15} /> Student directory</div>
          <h1>Our children</h1>
          <p>These profiles share approved introductions to students supported by HOS.</p>
          <div className="student-privacy-note">Public profiles contain only information entered for display here. Family contact details, dates of birth, health records, and safeguarding notes stay in staff records.</div>
        </div>
      </header>

      <section className="wrap section student-directory-section" aria-label="Student profiles">
        <div className="student-directory-toolbar">
          <div><span className="eyebrow">HOS student support</span><h2>Student profiles</h2></div>
          <label className="student-search"><Search size={16} /><span className="sr-only">Search students</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search students" /></label>
        </div>
        {syncWarning && <p className="field-hint" role="status">{syncWarning}</p>}
        {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading student profiles…</div>
          : error ? <div className="student-load-error" role="alert">{error}</div>
            : filteredStudents.length === 0
              ? <div className="student-empty-state"><UsersRound size={25} /><h3>{students.length ? 'No matching students' : 'Student profiles are being prepared'}</h3><p>{students.length ? 'Try a different name or school stage.' : 'The student support team will publish profiles as they are ready to share. Please check back soon.'}</p></div>
              : <div className="student-public-grid">{filteredStudents.map((student) => (
                <Link className="student-public-card" to={`/students/${encodeURIComponent(student.slug)}`} key={student.slug}>
                  <span className="student-public-avatar">{student.profile_photo_url ? <img src={student.profile_photo_url} alt="" /> : <UsersRound size={34} aria-hidden="true" />}</span>
                  {student.school_stage && <span className="student-stage">{student.school_stage}</span>}
                  <h3>{student.display_name}</h3>
                  <p>{student.public_bio || 'Student supported through Heart of Sympathy programs.'}</p>
                  <span className="student-card-link">Meet {student.display_name.split(' ')[0]} <ArrowRight size={15} /></span>
                </Link>
              ))}</div>}
      </section>
    </div>
  );
}

export function StudentProfilePage() {
  const { slug = '' } = useParams();
  const { students, isLoading, error } = useStudentDirectory();

  const student = students.find((item) => item.slug === slug);

  if (isLoading) return <div className="wrap section"><div className="loading-inline"><span className="loading-dot" /> Loading student profile…</div></div>;
  if (error) return <div className="wrap section"><div className="student-load-error" role="alert">{error}</div></div>;
  if (!student) return <div className="wrap section student-empty-state"><UsersRound size={25} /><h1>Profile not found</h1><p>This child profile may no longer be publicly available.</p><Link className="button button-outline" to="/students"><ArrowLeft size={15} /> Our children</Link></div>;

  return (
    <div className="student-public-page">
      <section className="wrap section student-profile-section">
        <Link className="student-back-link" to="/students"><ArrowLeft size={15} /> All children</Link>
        <div className="student-profile-hero">
          <div className="student-profile-photo">{student.profile_photo_url ? <img src={student.profile_photo_url} alt="" /> : <UsersRound size={42} aria-hidden="true" />}</div>
          <div className="student-profile-copy">
            <div className="eyebrow"><GraduationCap size={15} /> Student profile</div>
            {student.school_stage && <span className="student-stage">{student.school_stage}</span>}
            <h1>{student.display_name}</h1>
            {student.public_bio && <p className="student-profile-bio">{student.public_bio}</p>}
          </div>
        </div>
        <div className="student-profile-footer"><span>Learn about the students supported by Heart of Sympathy.</span><Link className="button button-outline" to="/students">Back to students <ArrowRight size={15} /></Link></div>
      </section>
    </div>
  );
}
