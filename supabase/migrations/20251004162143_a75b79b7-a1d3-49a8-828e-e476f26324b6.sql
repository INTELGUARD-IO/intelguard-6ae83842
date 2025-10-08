-- Drop existing primary key on validated_indicators
ALTER TABLE validated_indicators DROP CONSTRAINT validated_indicators_pkey;

-- Add new composite primary key on (indicator, kind)
ALTER TABLE validated_indicators ADD PRIMARY KEY (indicator, kind);
