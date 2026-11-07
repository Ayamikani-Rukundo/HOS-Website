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
    avatar_object_position: string;
    sort_order: number;
  }>;
};

type PartnerOrganization = {
  id: string;
  name: string;
  description: string | null;
  focus_area: string | null;
  logo_url: string | null;
  website_url: string | null;
  sort_order: number;
};

type Campaign = {
  id: string;
  category: string;
  slug: string | null;
  title: string;
  description: string | null;
  target_amount: number | null;
  raised_amount: number | null;
  currency_code: string;
  cover_image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
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

export type AdvocacyCampaign = {
  id: string;
  title: string;
  focus_area: string;
  summary: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  cover_image_url: string | null;
};

type CampaignCategory = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
};

type DonationMethod = {
  id: string;
  method_type: string;
  label: string;
  details: string;
  instructions: string | null;
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
  partners: PartnerOrganization[];
  campaigns: Campaign[];
  donationMethods: DonationMethod[];
  campaignCategories: CampaignCategory[];
  events: Event[];
  announcements: Announcement[];
  advocacyCampaigns: AdvocacyCampaign[];
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
  | 'partners'
  | 'campaigns'
  | 'donationMethods'
  | 'campaignCategories'
  | 'events'
  | 'announcements'
  | 'advocacyCampaigns'
  | 'gallery'
  | 'contactDetails'
  | 'socialLinks'
  | 'sections'
>;

const emptyData: SiteData = {
  organization: null,
  programs: [],
  teamYears: [],
  partners: [],
  campaigns: [],
  donationMethods: [],
  campaignCategories: [],
  events: [],
  announcements: [],
  advocacyCampaigns: [],
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
      console.error(`Website content is unavailable: ${supabaseConfigurationMessage}`);
      setError('Some website information is temporarily unavailable. Please try again later.');
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
      partnerResult,
      campaignResult,
      donationMethodsResult,
      categoryResult,
      eventResult,
      announcementResult,
      advocacyCampaignResult,
      galleryResult,
      galleryImagesResult,
      contactResult,
      socialResult,
      sectionResult,
    ] = await Promise.all([
      client.from('organizations').select('name,tagline,location,founded_year,mission,email,phone,address,logo_url').limit(1).maybeSingle(),
      client.from('programs').select('id,slug,name,summary,description,impact,feature_label,cover_image_url,additional_images,sort_order').eq('is_published', true).order('sort_order'),
      client.from('team_years').select('id,year_label').eq('is_published', true).order('sort_order'),
      client.from('team_members').select('id,team_year_id,full_name,role_title,focus_area,biography,avatar_url,avatar_object_position,sort_order').eq('is_published', true).eq('status', 'active').order('sort_order'),
      client.from('partner_organizations').select('id,name,description,focus_area,logo_url,website_url,sort_order').eq('is_published', true).is('archived_at', null).order('sort_order').order('name'),
      client.from('donation_campaigns').select('id,category,slug,title,description,target_amount,raised_amount,currency_code,cover_image_url,starts_at,ends_at,sort_order').eq('is_published', true).eq('status', 'active').is('archived_at', null).order('sort_order'),
      client.from('donation_methods').select('id,method_type,label,details,instructions').eq('is_active', true).eq('is_public', true).order('sort_order'),
      client.from('campaign_categories').select('id,name,description,sort_order').eq('is_published', true).is('archived_at', null).order('sort_order'),
      client.from('events').select('id,title,summary,event_date,starts_at,ends_at,location,image_url,cover_image_url,registration_url,status').eq('is_published', true).eq('status', 'published').is('archived_at', null).order('event_date'),
      client.from('announcements').select('id,title,body,cover_image_url,published_at,expires_at').eq('is_published', true).eq('status', 'published').eq('audience', 'public').is('archived_at', null).order('published_at', { ascending: false }),
      client.from('advocacy_campaigns').select('id,title,focus_area,summary,starts_at,ends_at,location,cover_image_url').eq('status', 'published').is('archived_at', null).order('starts_at'),
      client.from('galleries').select('id,title,image_url,alt_text,caption,description,collection_name,activity_date,sort_order').eq('is_published', true).is('archived_at', null).order('sort_order'),
      client.from('galleries').select('id,additional_images').eq('is_published', true).is('archived_at', null),
      client.from('contact_details').select('id,label,value,category,is_public').eq('is_public', true).is('archived_at', null).order('sort_order'),
      client.from('social_links').select('id,platform,url').eq('is_active', true).is('archived_at', null).order('sort_order'),
      client.from('website_sections').select('section_key,title,content').order('section_key'),
    ]);

    const galleryImagesColumnNotInstalled = galleryImagesResult.error?.message.includes('column galleries.additional_images does not exist') ?? false;
    const donationMethodsTableMissing = donationMethodsResult.error?.code === '42P01'
      || (
        donationMethodsResult.error?.code === 'PGRST205'
        && donationMethodsResult.error.message.includes('donation_methods')
      )
      || (
        donationMethodsResult.error?.message.includes('donation_methods') === true
        && donationMethodsResult.error.message.toLowerCase().includes('does not exist')
      );
    if (donationMethodsTableMissing) console.warn('Public donation methods are unavailable until the donation-methods migration is applied.', donationMethodsResult.error);
    const failure = [
      organizationResult.error,
      programResult.error,
      yearResult.error,
      memberResult.error,
      partnerResult.error,
      campaignResult.error,
      donationMethodsResult.error && !donationMethodsTableMissing ? donationMethodsResult.error : null,
      categoryResult.error,
      eventResult.error,
      announcementResult.error,
      advocacyCampaignResult.error,
      galleryResult.error,
      galleryImagesResult.error && !galleryImagesColumnNotInstalled ? galleryImagesResult.error : null,
      contactResult.error,
      socialResult.error,
      sectionResult.error,
    ].find((resultError) => resultError !== null);

    if (failure) {
      console.error('Website content could not be loaded from Supabase.', failure);
      setError('Some website information is temporarily unavailable. Please try again later.');
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
          .map(({ id, full_name, role_title, focus_area, biography, avatar_url, avatar_object_position, sort_order }) => ({
            id,
            full_name,
            role_title,
            focus_area,
            biography,
            avatar_url,
            avatar_object_position,
            sort_order,
          })),
      })),
      partners: partnerResult.data ?? [],
      campaigns: campaignResult.data ?? [],
      donationMethods: donationMethodsTableMissing ? [] : donationMethodsResult.data ?? [],
      campaignCategories: categoryResult.data ?? [],
      events: eventResult.data ?? [],
      announcements: announcementResult.data ?? [],
      advocacyCampaigns: advocacyCampaignResult.data ?? [],
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
      'partner_organizations',
      'donation_campaigns',
      'donation_methods',
      'campaign_categories',
      'events',
      'announcements',
      'advocacy_campaigns',
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
        console.error(`Website live updates could not connect (${status}).`);
        setRealtimeError('Live website updates are temporarily unavailable. Reload the page to check for recent changes.');
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
