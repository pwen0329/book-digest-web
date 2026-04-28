-- Migration 011: Create Event Signup Intro Templates
-- This migration creates the template system for customizable signup intros

BEGIN;

-- Step 1: Create event_signup_intros table
CREATE TABLE event_signup_intros (
  name TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  content_en TEXT NOT NULL,
  is_free BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Insert default paid event template with current hardcoded text
INSERT INTO event_signup_intros (name, content, content_en, is_free) VALUES (
  'default_paid',
  '感謝您的興趣！

為了確保每個人都有足夠的時間和空間進行有意義的討論，我們限制每場活動的參與人數。從 2026 年開始，我們將收取少量 {{payment_currency}} {{payment_amount}} 元的報名費，以幫助支付場地、網站和管理費用，並鼓勵出席。

這有助於我們保持每次聚會的質量一致——讓每一位來的您都能享受豐富而有價值的讀書會體驗。感謝您的理解與支持！',
  'THANKS FOR YOUR INTEREST!

To make sure everyone has enough time and space for meaningful discussion, we limit the number of participants per session. Starting in 2026, we will collect a small {{payment_currency}} {{payment_amount}} registration fee to help cover venue, website, and admin costs, and to encourage attendance.

This helps us keep the quality of each gathering consistent — so that every one of you who comes can enjoy a rich and worthwhile book club experience. Thank you for your understanding and support!',
  FALSE
);

-- Step 3: Add intro_template_name column to events table (NOT NULL with default, FK with ON DELETE RESTRICT)
ALTER TABLE events
  ADD COLUMN intro_template_name TEXT NOT NULL DEFAULT 'default_paid',
  ADD CONSTRAINT events_intro_template_name_fkey
    FOREIGN KEY (intro_template_name)
    REFERENCES event_signup_intros(name)
    ON DELETE RESTRICT;

-- Step 4: Create index on intro_template_name for efficient lookups
CREATE INDEX idx_events_intro_template_name ON events(intro_template_name);

COMMIT;
