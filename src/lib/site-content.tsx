import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSupabaseClient, isSupabaseConfigured, supabaseConfigurationMessage } from './supabase';
import { useAuth } from './auth-context';
import { SiteContentContext } from './site-content-context';

type Organization = {
  name: string;
  tagline: string | null;
  location: string | null;
  founded_year: string | null;
  mission: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
};

type Program = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  impact: string | null;
  feature_label: string | null;
  cover_image_url: string | null;
  additional_images: Array<{ url: string; caption?: string }>;
  sort_order: number;
};

type TeamYear = {
  id: string;
  year_label: string;
  members: Array<{
    id: string;
    full_name: string;
    role_title: string | null;
    focus_area: string | null;
    biography: string | null;
    avatar_url: string | null;
    sort_order: number;
  }>;
};

type Project = {
  id: string;
  program_id: string | null;
  title: string;
  description: string | null;
  outcome_summary: string | null;
  location: string | null;
  status: string;
  start_date: string | null;
  completed_at: string | null;
  cover_image_url: string | null;
};

type Campaign = {
  id: string;
  category_id: string | null;
  slug: string | null;
  title: string;
  description: string | null;
  target_amount: number | null;
  raised_amount: number | null;
  currency_code: string;
  cover_image_url: string | null;
  donation_instructions: string | null;
  suggested_amounts: number[];
  payment_methods: string[];
  sort_order: number;
};

type ImpactMetric = {
  id: string;
  label: string;
  value: string;
  description: string | null;
};

type SuccessStory = {
  id: string;
  title: string;
  summary: string;
  story: string | null;
  image_url: string | null;
};

type Event = {
  id: string;
  title: string;
  summary: string | null;
  event_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  registration_url: string | null;
  status: string;
};

type Announcement = {
  id: string;
  title: string;
  body: string;
  cover_image_url: string | null;
  published_at: string;
  expires_at: string | null;
};

type CampaignCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

type ContactDetail = {
  id: string;
  label: string;
  value: string;
  category: string;
  is_public: boolean;
};

type GalleryImage = {
  id: string;
  title: string | null;
  image_url: string;
  additional_images: Array<{ url: string; caption?: string }>;
  alt_text: string | null;
  caption: string | null;
  description: string | null;
  collection_name: string | null;
  activity_date: string | null;
  sort_order: number;
};

type SocialLink = {
  id: string;
  platform: string;
  url: string;
};

type WebsiteSection = {
  title: string;
  content: Record<string, unknown>;
};

export type SiteContent = {
  organization: Organization | null;
  programs: Program[];
  teamYears: TeamYear[];
  projects: Project[];
  campaigns: Campaign[];
  campaignCategories: CampaignCategory[];
  metrics: ImpactMetric[];
  stories: SuccessStory[];
  events: Event[];
  announcements: Announcement[];
  gallery: GalleryImage[];
  contactDetails: ContactDetail[];
  socialLinks: SocialLink[];
  sections: Record<string, WebsiteSection>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

type SiteData = Pick<
  SiteContent,
  | 'organization'
  | 'programs'
  | 'teamYears'
  | 'projects'
  | 'campaigns'
  | 'campaignCategories'
  | 'metrics'
  | 'stories'
  | 'events'
  | 'announcements'
  | 'gallery'
  | 'contactDetails'
  | 'socialLinks'
  | 'sections'
>;

const emptyData: SiteData = {
  organization: null,
  programs: [],
  teamYears: [],
  projects: [],
  campaigns: [],
  campaignCategories: [],
  metrics: [],
  stories: [],
  events: [],
  announcements: [],
  gallery: [],
  contactDetails: [],
  socialLinks: [],
  sections: {},
};

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<SiteData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeError, setRealtimeError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError(`Database content is unavailable. ${supabaseConfigurationMessage}`);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const client = getSupabaseClient();
    const [
      organizationResult,
      programResult,
      yearResult,
      memberResult,
      projectResult,
      campaignResult,
      categoryResult,
      metricResult,
      storyResult,
      eventResult,
      announcementResult,
      galleryResult,
      galleryImagesResult,
      contactResult,
      socialResult,
      sectionResult,
    ] = await Promise.all([
      client.from('organizations').select('name,tagline,location,founded_year,mission,email,phone,address,logo_url').limit(1).maybeSingle(),
      client.from('programs').select('id,slug,name,summary,description,impact,feature_label,cover_image_url,additional_images,sort_order').eq('is_published', true).order('sort_order'),
      client.from('team_years').select('id,year_label').eq('is_published', true).order('sort_order'),
      client.from('team_members').select('id,team_year_id,full_name,role_title,focus_area,biography,avatar_url,sort_order').eq('is_published', true).eq('status', 'active').order('sort_order'),
      client.from('projects').select('id,program_id,title,description,outcome_summary,location,status,start_date,completed_at,cover_image_url').eq('is_published', true).is('archived_at', null).order('start_date', { ascending: false }),
      client.from('donation_campaigns').select('id,category_id,slug,title,description,target_amount,raised_amount,currency_code,cover_image_url,donation_instructions,suggested_amounts,payment_methods,sort_order').eq('is_published', true).eq('status', 'active').is('archived_at', null).order('sort_order'),
      client.from('campaign_categories').select('id,name,description,sort_order').eq('is_published', true).is('archived_at', null).order('sort_order'),
      client.from('impact_metrics').select('id,label,value,description').eq('is_published', true).order('sort_order'),
      client.from('success_stories').select('id,title,summary,story,image_url').eq('is_published', true).order('published_at', { ascending: false }),
      client.from('events').select('id,title,summary,event_date,starts_at,ends_at,location,image_url,cover_image_url,registration_url,status').eq('is_published', true).eq('status', 'published').is('archived_at', null).order('event_date'),
      client.from('announcements').select('id,title,body,cover_image_url,published_at,expires_at').eq('is_published', true).eq('status', 'published').eq('audience', 'public').is('archived_at', null).order('published_at', { ascending: false }),
      client.from('galleries').select('id,title,image_url,alt_text,caption,description,collection_name,activity_date,sort_order').eq('is_published', true).is('archived_at', null).order('sort_order'),
      client.from('galleries').select('id,additional_images').eq('is_published', true).is('archived_at', null),
      client.from('contact_details').select('id,label,value,category,is_public').eq('is_public', true).is('archived_at', null).order('sort_order'),
      client.from('social_links').select('id,platform,url').eq('is_active', true).is('archived_at', null).order('sort_order'),
      client.from('website_sections').select('section_key,title,content').order('section_key'),
    ]);

    const galleryImagesColumnNotInstalled = galleryImagesResult.error?.message.includes('column galleries.additional_images does not exist') ?? false;
    const failure = [
      organizationResult.error,
      programResult.error,
      yearResult.error,
      memberResult.error,
      projectResult.error,
      campaignResult.error,
      categoryResult.error,
      metricResult.error,
      storyResult.error,
      eventResult.error,
      announcementResult.error,
      galleryResult.error,
      galleryImagesResult.error && !galleryImagesColumnNotInstalled ? galleryImagesResult.error : null,
      contactResult.error,
      socialResult.error,
      sectionResult.error,
    ].find((resultError) => resultError !== null);

    if (failure) {
      setError(`Could not load website content from Supabase: ${failure.message}`);
      setIsLoading(false);
      return;
    }

    const members = memberResult.data ?? [];
    setData({
      organization: organizationResult.data,
      programs: programResult.data ?? [],
      teamYears: (yearResult.data ?? []).map((year) => ({
        ...year,
        members: members
          .filter((member) => member.team_year_id === year.id)
          .map(({ id, full_name, role_title, focus_area, biography, avatar_url, sort_order }) => ({
            id,
            full_name,
            role_title,
            focus_area,
            biography,
            avatar_url,
            sort_order,
          })),
      })),
      projects: projectResult.data ?? [],
      campaigns: campaignResult.data ?? [],
      campaignCategories: categoryResult.data ?? [],
      metrics: metricResult.data ?? [],
      stories: storyResult.data ?? [],
      events: eventResult.data ?? [],
      announcements: announcementResult.data ?? [],
      gallery: (galleryResult.data ?? []).map((image) => ({
        ...image,
        additional_images: galleryImagesResult.data?.find((images) => images.id === image.id)?.additional_images ?? [],
      })),
      contactDetails: contactResult.data ?? [],
      socialLinks: socialResult.data ?? [],
      sections: Object.fromEntries(
        (sectionResult.data ?? []).map((section) => [
          section.section_key,
          { title: section.title, content: section.content },
        ]),
      ),
    });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let active = true;
    const client = getSupabaseClient();
    const watchedTables = [
      'organizations',
      'programs',
      'team_years',
      'team_members',
      'projects',
      'donation_campaigns',
      'campaign_categories',
      'impact_metrics',
      'success_stories',
      'events',
      'announcements',
      'galleries',
      'contact_details',
      'social_links',
      'website_sections',
    ];
    const channel = watchedTables.reduce(
      (currentChannel, table) =>
        currentChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          () => {
            void refresh();
          },
        ),
      client.channel('public-site-content'),
    );

    channel.subscribe((status) => {
      if (!active) return;
      if (status === 'SUBSCRIBED') {
        setRealtimeError(null);
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setRealtimeError(`Supabase Realtime subscription failed (${status}).`);
      }
    });

    return () => {
      active = false;
      void client.removeChannel(channel);
    };
  }, [refresh, user?.id]);

  const value = useMemo(
    () => ({ ...data, isLoading, error: error ?? realtimeError, refresh }),
    [data, error, isLoading, realtimeError, refresh],
  );

  return <SiteContentContext.Provider value={value}>{children}</SiteContentContext.Provider>;
}
