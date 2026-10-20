-- RePlate FT-III migration. Run AFTER database/schema.sql in Supabase SQL Editor.
-- Review on a development project before production use. No service-role key is used by the browser.

CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid() AND r.name = required_role
  );
$$;

-- Create application profile and role-specific profile when Supabase Auth creates a user.
CREATE OR REPLACE FUNCTION public.handle_new_replate_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_role TEXT;
  org_name TEXT;
  service_area TEXT;
BEGIN
  chosen_role := COALESCE(NEW.raw_user_meta_data->>'role', 'provider');
  IF chosen_role NOT IN ('provider', 'ngo', 'volunteer') THEN chosen_role := 'provider'; END IF;
  org_name := NULLIF(BTRIM(NEW.raw_user_meta_data->>'organization_name'), '');
  service_area := NULLIF(BTRIM(NEW.raw_user_meta_data->>'service_area'), '');

  INSERT INTO public.profiles (id, full_name, email, city)
  VALUES (NEW.id, COALESCE(NULLIF(BTRIM(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1)), NEW.email, service_area)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role_id)
  SELECT NEW.id, r.id FROM public.roles r WHERE r.name = chosen_role
  ON CONFLICT (user_id, role_id) DO NOTHING;

  IF chosen_role = 'provider' THEN
    INSERT INTO public.provider_profiles (id, organization_name, provider_type, pickup_address)
    VALUES (NEW.id, COALESCE(org_name, 'Food donor'), COALESCE(NULLIF(NEW.raw_user_meta_data->>'provider_type',''), 'other'), service_area)
    ON CONFLICT (id) DO NOTHING;
  ELSIF chosen_role = 'ngo' THEN
    INSERT INTO public.ngo_profiles (id, organization_name, service_area, address)
    VALUES (NEW.id, COALESCE(org_name, 'Community organization'), service_area, service_area)
    ON CONFLICT (id) DO NOTHING;
  ELSIF chosen_role = 'volunteer' THEN
    INSERT INTO public.volunteer_profiles (id, service_area, availability_status)
    VALUES (NEW.id, service_area, 'available')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_replate ON auth.users;
CREATE TRIGGER on_auth_user_created_replate
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_replate_user();


-- Backfill accounts created before this migration was installed.
INSERT INTO public.profiles (id, full_name, email, city)
SELECT u.id,
       COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'full_name'), ''), split_part(COALESCE(u.email,''), '@', 1), 'RePlate user'),
       u.email,
       NULLIF(BTRIM(u.raw_user_meta_data->>'service_area'), '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
JOIN public.roles r ON r.name = CASE
  WHEN u.raw_user_meta_data->>'role' IN ('provider','ngo','volunteer') THEN u.raw_user_meta_data->>'role'
  ELSE 'provider' END
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO public.provider_profiles (id, organization_name, provider_type, pickup_address)
SELECT u.id, COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'organization_name'), ''), 'Food donor'),
       COALESCE(NULLIF(u.raw_user_meta_data->>'provider_type',''), 'other'),
       NULLIF(BTRIM(u.raw_user_meta_data->>'service_area'), '')
FROM auth.users u
WHERE COALESCE(u.raw_user_meta_data->>'role', 'provider') NOT IN ('ngo','volunteer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.ngo_profiles (id, organization_name, service_area, address)
SELECT u.id, COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'organization_name'), ''), 'Community organization'),
       NULLIF(BTRIM(u.raw_user_meta_data->>'service_area'), ''), NULLIF(BTRIM(u.raw_user_meta_data->>'service_area'), '')
FROM auth.users u WHERE u.raw_user_meta_data->>'role' = 'ngo'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.volunteer_profiles (id, service_area, availability_status)
SELECT u.id, NULLIF(BTRIM(u.raw_user_meta_data->>'service_area'), ''), 'available'
FROM auth.users u WHERE u.raw_user_meta_data->>'role' = 'volunteer'
ON CONFLICT (id) DO NOTHING;

-- Request approval reserves the listing and creates one delivery record.
CREATE OR REPLACE FUNCTION public.handle_replate_request_status()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.food_listings SET status = 'reserved', updated_at = NOW()
      WHERE id = NEW.listing_id AND status = 'available' AND expiry_time > NOW();
    IF NOT FOUND THEN RAISE EXCEPTION 'This food listing is no longer available.'; END IF;
    INSERT INTO public.deliveries (request_id, status)
      VALUES (NEW.id, 'pending_assignment')
      ON CONFLICT (request_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS food_request_status_replate ON public.food_requests;
CREATE TRIGGER food_request_status_replate
AFTER UPDATE OF status ON public.food_requests
FOR EACH ROW EXECUTE FUNCTION public.handle_replate_request_status();

-- Protect request fields and allow only expected role-based status transitions.
CREATE OR REPLACE FUNCTION public.validate_replate_request_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE listing_owner UUID;
BEGIN
  IF NEW.listing_id IS DISTINCT FROM OLD.listing_id
    OR NEW.ngo_id IS DISTINCT FROM OLD.ngo_id
    OR NEW.requested_quantity IS DISTINCT FROM OLD.requested_quantity
    OR NEW.message IS DISTINCT FROM OLD.message
    OR NEW.requested_at IS DISTINCT FROM OLD.requested_at THEN
    RAISE EXCEPTION 'Request details cannot be changed after submission.';
  END IF;
  SELECT provider_id INTO listing_owner FROM public.food_listings WHERE id = OLD.listing_id;
  IF public.has_role('provider') AND listing_owner = auth.uid()
     AND OLD.status = 'pending' AND NEW.status IN ('approved','rejected') THEN
    NEW.responded_at := NOW(); RETURN NEW;
  END IF;
  IF public.has_role('ngo') AND OLD.ngo_id = auth.uid()
     AND OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'You are not permitted to make this request status change.';
END;
$$;
DROP TRIGGER IF EXISTS validate_replate_request_update ON public.food_requests;
CREATE TRIGGER validate_replate_request_update
BEFORE UPDATE ON public.food_requests
FOR EACH ROW EXECUTE FUNCTION public.validate_replate_request_update();

-- Validate volunteer claims and delivery state transitions.
CREATE OR REPLACE FUNCTION public.validate_replate_delivery_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.volunteer_id IS NULL AND OLD.status = 'pending_assignment'
     AND NEW.volunteer_id = auth.uid() AND NEW.status = 'assigned'
     AND public.has_role('volunteer') THEN
    NEW.assigned_at := NOW(); RETURN NEW;
  END IF;
  IF OLD.volunteer_id = auth.uid() AND NEW.volunteer_id = OLD.volunteer_id
     AND public.has_role('volunteer') AND (
       (OLD.status = 'assigned' AND NEW.status = 'picked_up') OR
       (OLD.status = 'picked_up' AND NEW.status = 'in_transit') OR
       (OLD.status = 'in_transit' AND NEW.status = 'delivered')
     ) THEN
    IF NEW.status = 'picked_up' THEN NEW.pickup_time := NOW(); END IF;
    IF NEW.status = 'delivered' THEN NEW.delivery_time := NOW(); END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Invalid delivery transition or insufficient permissions.';
END;
$$;
DROP TRIGGER IF EXISTS validate_replate_delivery_update ON public.deliveries;
CREATE TRIGGER validate_replate_delivery_update
BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.validate_replate_delivery_update();

-- On successful handover, update listing status and create a transparent impact estimate.
CREATE OR REPLACE FUNCTION public.record_replate_delivery_impact()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE listing_row public.food_listings%ROWTYPE;
DECLARE saved_kg NUMERIC(10,2);
DECLARE meal_count INTEGER;
BEGIN
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    SELECT fl.* INTO listing_row
      FROM public.food_requests fr JOIN public.food_listings fl ON fl.id = fr.listing_id
      WHERE fr.id = NEW.request_id;
    IF FOUND THEN
      UPDATE public.food_listings SET status = 'delivered', updated_at = NOW() WHERE id = listing_row.id;
      saved_kg := CASE WHEN lower(listing_row.quantity_unit) = 'kg' THEN listing_row.quantity ELSE 0 END;
      -- Demonstration assumption: 0.4 kg per meal. Items are counted as one meal each.
      meal_count := CASE WHEN lower(listing_row.quantity_unit) = 'kg' THEN ROUND(listing_row.quantity / 0.4)::INTEGER
                         WHEN lower(listing_row.quantity_unit) = 'items' THEN ROUND(listing_row.quantity)::INTEGER
                         ELSE 0 END;
      INSERT INTO public.impact_records (listing_id, food_saved_kg, meals_served, beneficiaries_count, co2_saved_kg)
      VALUES (listing_row.id, saved_kg, GREATEST(meal_count,0), 0, ROUND(saved_kg * 2.5, 2))
      ON CONFLICT (listing_id) DO NOTHING;
      INSERT INTO public.notifications (user_id,title,message,notification_type,related_listing_id,related_request_id)
      SELECT listing_row.provider_id, 'Food delivered', 'Your food donation was marked as delivered.', 'delivery', listing_row.id, (SELECT request_id FROM public.deliveries WHERE id=NEW.id)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS record_replate_delivery_impact ON public.deliveries;
CREATE TRIGGER record_replate_delivery_impact
AFTER UPDATE OF status ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.record_replate_delivery_impact();

-- SECURITY DEFINER lookup helpers avoid recursive RLS joins between listings, requests and deliveries.
CREATE OR REPLACE FUNCTION public.owns_replate_listing(target_listing_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.food_listings WHERE id = target_listing_id AND provider_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.has_replate_request_for_listing(target_listing_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.food_requests WHERE listing_id = target_listing_id AND ngo_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.is_replate_request_ngo(target_request_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.food_requests WHERE id = target_request_id AND ngo_id = auth.uid());
$$;
CREATE OR REPLACE FUNCTION public.owns_replate_delivery_listing(target_request_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.food_requests fr JOIN public.food_listings fl ON fl.id = fr.listing_id WHERE fr.id = target_request_id AND fl.provider_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_replate_delivery_for_listing(target_listing_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.food_requests fr JOIN public.deliveries d ON d.request_id = fr.id
    WHERE fr.listing_id = target_listing_id AND (
      d.volunteer_id = auth.uid() OR
      (d.volunteer_id IS NULL AND d.status = 'pending_assignment' AND public.has_role('volunteer'))
    )
  );
$$;
CREATE OR REPLACE FUNCTION public.can_view_replate_request(target_request_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.food_requests fr JOIN public.food_listings fl ON fl.id = fr.listing_id
    WHERE fr.id = target_request_id AND (
      fr.ngo_id = auth.uid() OR fl.provider_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.deliveries d WHERE d.request_id = fr.id AND (
          d.volunteer_id = auth.uid() OR
          (d.volunteer_id IS NULL AND d.status = 'pending_assignment' AND public.has_role('volunteer'))
        )
      )
    )
  );
$$;

-- Enable RLS for all application tables.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ngo_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Remove policies from the initial schema / prior migration so this script can be re-run.
DROP POLICY IF EXISTS "Anyone can view food categories" ON public.food_categories;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DO $$ DECLARE p RECORD; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname='public' AND tablename IN
    ('profiles','roles','user_roles','provider_profiles','ngo_profiles','volunteer_profiles','food_categories','food_listings','food_requests','deliveries','impact_records','notifications')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename); END LOOP;
END $$;

CREATE POLICY profiles_select_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY roles_read_authenticated ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY user_roles_read_self ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY provider_profiles_read_self ON public.provider_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY provider_profiles_insert_self ON public.provider_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND public.has_role('provider'));
CREATE POLICY provider_profiles_update_self ON public.provider_profiles FOR UPDATE TO authenticated USING (id = auth.uid() AND public.has_role('provider')) WITH CHECK (id = auth.uid() AND public.has_role('provider'));
CREATE POLICY ngo_profiles_read_self ON public.ngo_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY ngo_profiles_insert_self ON public.ngo_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND public.has_role('ngo'));
CREATE POLICY ngo_profiles_update_self ON public.ngo_profiles FOR UPDATE TO authenticated USING (id = auth.uid() AND public.has_role('ngo')) WITH CHECK (id = auth.uid() AND public.has_role('ngo'));
CREATE POLICY volunteer_profiles_read_self ON public.volunteer_profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY volunteer_profiles_insert_self ON public.volunteer_profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid() AND public.has_role('volunteer'));
CREATE POLICY volunteer_profiles_update_self ON public.volunteer_profiles FOR UPDATE TO authenticated USING (id = auth.uid() AND public.has_role('volunteer')) WITH CHECK (id = auth.uid() AND public.has_role('volunteer'));
CREATE POLICY categories_read_all ON public.food_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY listings_read_available_or_own ON public.food_listings FOR SELECT TO authenticated USING ((public.has_role('ngo') AND status = 'available' AND expiry_time > NOW()) OR provider_id = auth.uid() OR public.has_replate_request_for_listing(id) OR public.has_replate_delivery_for_listing(id));
CREATE POLICY listings_insert_provider ON public.food_listings FOR INSERT TO authenticated WITH CHECK (provider_id = auth.uid() AND public.has_role('provider'));
CREATE POLICY listings_update_provider ON public.food_listings FOR UPDATE TO authenticated USING (provider_id = auth.uid() AND public.has_role('provider')) WITH CHECK (provider_id = auth.uid() AND public.has_role('provider'));
CREATE POLICY listings_delete_provider ON public.food_listings FOR DELETE TO authenticated USING (provider_id = auth.uid() AND public.has_role('provider') AND status IN ('draft','available'));
CREATE POLICY requests_read_parties ON public.food_requests FOR SELECT TO authenticated USING (public.can_view_replate_request(id));
CREATE POLICY requests_insert_ngo ON public.food_requests FOR INSERT TO authenticated WITH CHECK (ngo_id = auth.uid() AND public.has_role('ngo') AND EXISTS (SELECT 1 FROM public.food_listings fl WHERE fl.id = listing_id AND fl.status = 'available' AND fl.expiry_time > NOW() AND requested_quantity <= fl.quantity));
CREATE POLICY requests_update_parties ON public.food_requests FOR UPDATE TO authenticated USING (ngo_id = auth.uid() OR public.owns_replate_listing(listing_id)) WITH CHECK (ngo_id = auth.uid() OR public.owns_replate_listing(listing_id));
CREATE POLICY deliveries_read_parties ON public.deliveries FOR SELECT TO authenticated USING (volunteer_id = auth.uid() OR (volunteer_id IS NULL AND status = 'pending_assignment' AND public.has_role('volunteer')) OR public.is_replate_request_ngo(request_id) OR public.owns_replate_delivery_listing(request_id));
CREATE POLICY deliveries_update_volunteer ON public.deliveries FOR UPDATE TO authenticated USING ((volunteer_id = auth.uid() AND public.has_role('volunteer')) OR (volunteer_id IS NULL AND status = 'pending_assignment' AND public.has_role('volunteer'))) WITH CHECK ((volunteer_id = auth.uid() AND public.has_role('volunteer')));
CREATE POLICY impact_read_authenticated ON public.impact_records FOR SELECT TO authenticated USING (true);
CREATE POLICY notifications_read_self ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notifications_update_self ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Indexes used by the app's primary list and join operations.
CREATE INDEX IF NOT EXISTS idx_food_listings_available_expiry ON public.food_listings(status, expiry_time);
CREATE INDEX IF NOT EXISTS idx_food_requests_ngo_status ON public.food_requests(ngo_id, status);
CREATE INDEX IF NOT EXISTS idx_deliveries_volunteer_status ON public.deliveries(volunteer_id, status);
CREATE INDEX IF NOT EXISTS idx_impact_records_recorded_at ON public.impact_records(recorded_at DESC);
