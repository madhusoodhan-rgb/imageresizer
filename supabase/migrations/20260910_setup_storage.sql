-- Grant storage policies for image-uploads bucket
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select on image-uploads' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Allow public select on image-uploads"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'image-uploads');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on image-uploads' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Allow public insert on image-uploads"
        ON storage.objects FOR INSERT
        TO public
        WITH CHECK (bucket_id = 'image-uploads');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on image-uploads' AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Allow public update on image-uploads"
        ON storage.objects FOR UPDATE
        TO public
        USING (bucket_id = 'image-uploads');
    END IF;
END $$;
