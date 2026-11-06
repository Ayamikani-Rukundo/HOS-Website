type Table<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      organizations: Table<{
        id: string;
        name: string;
        tagline: string | null;
        location: string | null;
        founded_year: string | null;
        mission: string | null;
        email: string | null;
        phone: string | null;
        address: string | null;
        logo_url: string | null;
        website_url: string | null;
        currency_code: string;
      }>;
      user_roles: Table<{
        id: string;
        user_id: string;
        role_name: string;
        created_at: string;
      }>;
      team_years: Table<{
        id: string;
        year_label: string;
        active: boolean;
        is_published: boolean;
        sort_order: number;
      }>;
      team_members: Table<{
        id: string;
        team_year_id: string;
        full_name: string;
        role_title: string | null;
        focus_area: string | null;
        biography: string | null;
        email: string | null;
        avatar_url: string | null;
        avatar_object_position: string;
        sort_order: number;
        is_published: boolean;
        status: string;
      }>;
      programs: Table<{
        id: string;
        slug: string;
        name: string;
        summary: string;
        description: string | null;
        impact: string | null;
        highlights: string | null;
        feature_label: string | null;
        is_featured: boolean;
        is_published: boolean;
        sort_order: number;
        cover_image_url: string | null;
        additional_images: Array<{ url: string; caption?: string }>;
        objectives: unknown[];
      }>;
      partner_organizations: Table<{
        id: string;
        name: string;
        description: string | null;
        focus_area: string | null;
        logo_url: string | null;
        website_url: string | null;
        is_published: boolean;
        sort_order: number;
        created_at: string;
        updated_at: string;
        archived_at: string | null;
      }>;
      events: Table<{
        id: string;
        title: string;
        summary: string | null;
        event_date: string | null;
        location: string | null;
        image_url: string | null;
        is_published: boolean;
        registration_url: string | null;
        cover_image_url: string | null;
        starts_at: string | null;
        ends_at: string | null;
        status: string;
        published_at: string | null;
        notify_subscribers: boolean;
        archived_at: string | null;
      }>;
      announcements: Table<{
        id: string;
        title: string;
        body: string;
        audience: string;
        status: string;
        is_published: boolean;
        published_at: string;
        expires_at: string | null;
        cover_image_url: string | null;
        notify_subscribers: boolean;
        archived_at: string | null;
      }>;
      campaign_categories: Table<{
        id: string;
        name: string;
        description: string | null;
        sort_order: number;
        is_published: boolean;
        icon: string | null;
        archived_at: string | null;
      }>;
      donation_campaigns: Table<{
        id: string;
        category_id: string | null;
        category: string;
        slug: string | null;
        title: string;
        description: string | null;
        target_amount: number | null;
        raised_amount: number | null;
        currency_code: string;
        status: string;
        is_published: boolean;
        starts_at: string | null;
        ends_at: string | null;
        cover_image_url: string | null;
        donation_instructions: string | null;
        suggested_amounts: number[];
        payment_methods: string[];
        sort_order: number;
        archived_at: string | null;
      }>;
      finance_transactions: Table<{
        id: string;
        transaction_type: string;
        category: string;
        description: string;
        amount: number;
        currency_code: string;
        transaction_date: string;
        payment_method: string | null;
        reference_number: string | null;
        document_url: string | null;
        document_path: string | null;
        document_name: string | null;
        notes: string | null;
        status: string;
        recorded_by: string | null;
        created_at: string;
        updated_at: string;
        archived_at: string | null;
      }>;
      galleries: Table<{
        id: string;
        title: string | null;
        image_url: string;
        additional_images: Array<{ url: string; caption: string }>;
        caption: string | null;
        alt_text: string | null;
        is_published: boolean;
        sort_order: number;
        description: string | null;
        collection_name: string | null;
        activity_date: string | null;
        archived_at: string | null;
      }>;
      contact_details: Table<{
        id: string;
        label: string;
        value: string;
        category: string;
        is_public: boolean;
        sort_order: number;
        archived_at: string | null;
      }>;
      social_links: Table<{
        id: string;
        platform: string;
        url: string;
        is_active: boolean;
        sort_order: number;
        archived_at: string | null;
      }>;
      website_sections: Table<{
        id: string;
        section_key: string;
        title: string;
        content: Record<string, unknown>;
        is_published: boolean;
      }>;
      volunteer_applications: Table<{
        id: string;
        full_name: string;
        email: string;
        phone: string | null;
        interests: string[];
        availability: string | null;
        message: string | null;
        status: string;
        assigned_to: string | null;
        created_at: string;
        updated_at: string;
      }>;
      website_page_views: Table<{
        id: number;
        page_path: string;
        referrer_host: string | null;
        country_code: string | null;
        created_at: string;
      }>;
      donors: Table<{
        id: string;
        full_name: string | null;
        email: string | null;
        phone: string | null;
        organization_name: string | null;
        is_anonymous: boolean;
        created_at: string;
      }>;
      donation_methods: Table<{
        id: string;
        method_type: string;
        label: string;
        details: string;
        instructions: string | null;
        is_active: boolean;
        is_public: boolean;
        sort_order: number;
        created_at: string;
        updated_at: string;
      }>;
      contact_messages: Table<{
        id: string;
        full_name: string;
        email: string;
        subject: string;
        message: string;
        status: string;
        assigned_to: string | null;
      }>;
      newsletter_subscribers: Table<{
        id: string;
        email: string;
        name: string | null;
        is_confirmed: boolean;
        unsubscribed_at: string | null;
        unsubscribe_token_hash: string | null;
        consented_at: string;
        source: string;
      }>;
      grant_opportunities: Table<{
        id: string;
        title: string;
        funder_name: string;
        status: string;
        focus_area: string | null;
        amount: number | null;
        currency_code: string;
        deadline: string | null;
        application_url: string | null;
        notes: string | null;
        created_at: string;
        updated_at: string;
        archived_at: string | null;
      }>;
      families: Table<{
        id: string;
        household_code: string | null;
        primary_contact_name: string;
        phone: string | null;
        email: string | null;
        address: string | null;
        district: string | null;
        sector: string | null;
        household_size: number | null;
        vulnerability_notes: string | null;
        status: string;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      children: Table<{
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
        safeguarding_notes: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }>;
      student_public_profiles: Table<{
        id: string;
        child_id: string;
        slug: string;
        display_name: string;
        profile_photo_url: string | null;
        public_bio: string | null;
        public_support_summary: string | null;
        school_stage: string | null;
        is_published: boolean;
        published_at: string | null;
        created_at: string;
        updated_at: string;
      }>;
      student_support_updates: Table<{
        id: string;
        child_id: string;
        occurred_on: string;
        category: string;
        title: string;
        private_notes: string | null;
        public_summary: string | null;
        is_public: boolean;
        created_by: string | null;
        created_at: string;
        updated_at: string;
      }>;
      student_directory_events: Table<{
        id: string;
        profile_slug: string;
        created_at: string;
      }>;
    };
    Views: {
      public_student_profiles: {
        Row: {
          slug: string;
          display_name: string;
          profile_photo_url: string | null;
          public_bio: string | null;
          public_support_summary: string | null;
          school_stage: string | null;
        };
        Relationships: [];
      };
      public_student_updates: {
        Row: {
          slug: string;
          occurred_on: string;
          category: string;
          public_summary: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_admin_portal_metrics: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{ portal_key: string; table_name: string; record_count: number }>;
      };
      delete_audit_events_by_ids: {
        Args: { p_event_ids: string[] };
        Returns: number;
      };
      has_any_role: {
        Args: { required_roles: string[] };
        Returns: boolean;
      };
      unsubscribe_newsletter: {
        Args: { p_token_hash: string };
        Returns: boolean;
      };
      subscribe_newsletter: {
        Args: { p_email: string; p_token_hash: string; p_source: string; p_consented: boolean };
        Returns: boolean;
      };
      get_staff_directory: {
        Args: Record<string, never>;
        Returns: Array<{
          user_id: string;
          email: string | null;
          full_name: string | null;
          roles: string[];
          created_at: string;
        }>;
      };
      purge_audit_events: {
        Args: { p_from: string; p_through: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
