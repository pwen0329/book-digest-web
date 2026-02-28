// Notion integration helpers for Phase 1 external processor (server-side only)
// This file maps SignupForm fields to a Notion database with the following columns:
// "Created Date","Name","Email","Age","Occupation","InstagramAccount","FindingUs",
// "findingUsOthers","Purpose","Attendance","Updated Date","status","Owner","ID",
// "Title","visitorId","bankAccount"
// Only a subset is populated from the form; others remain blank/default.

import { Client } from '@notionhq/client';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { cryptoRandomId } from '@/lib/crypto-id';

export type RegistrationInput = {
  location: 'TW' | 'NL';
  name: string;
  age: number;
  profession: string;
  email: string;
  instagram?: string;
  referral: 'Instagram' | 'Facebook' | 'Others';
  referralOther?: string;
  bankAccount?: string;
  timestamp?: string; // ISO
  visitorId?: string;
};

function getNotion(): Client | null {
  const token = process.env.NOTION_TOKEN;
  if (!token) return null;

  const proxy = process.env.https_proxy || process.env.http_proxy;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options: Record<string, unknown> = { auth: token };

  if (proxy) {
    options.agent = new HttpsProxyAgent(proxy);
  }

  return new Client(options as ConstructorParameters<typeof Client>[0]);
}

export async function saveRegistrationToNotion(dbId: string, data: RegistrationInput) {
  const notion = getNotion();
  if (!notion) throw new Error('NOTION_TOKEN is not configured');

  // Compose values
  const fullName = data.name.trim();
  const titleText = `${fullName} — ${data.location}`;
  const idText = cryptoRandomId();

  // Map to Notion properties. Types are chosen to be broadly compatible:
  // - Title: title
  // - Name: rich_text
  // - Email: email
  // - Age: number
  // - Occupation: rich_text
  // - InstagramAccount: rich_text
  // - FindingUs: select
  // - findingUsOthers: rich_text
  // - ID: rich_text
  // - visitorId/bankAccount/Purpose/Attendance/status/Owner: left empty
  type TextProperty = { type: 'text'; text: { content: string } };
  type RichTextProp = { rich_text: TextProperty[] };
  type TitleProp = { title: TextProperty[] };
  type EmailProp = { email: string };
  type NumberProp = { number: number | null };
  type SelectProp = { select: { name: string } };
  type Properties = {
    Title: TitleProp;
    Name: RichTextProp;
    Email: EmailProp;
    Location: SelectProp;
    Age: NumberProp;
    Occupation: RichTextProp;
    InstagramAccount: RichTextProp;
    FindingUs: SelectProp;
    findingUsOthers: RichTextProp;
    ID: RichTextProp;
    visitorId?: RichTextProp;
    bankAccount?: RichTextProp;
    [key: string]: unknown;
  };
  const properties: Properties = {
    Title: { title: [{ type: 'text', text: { content: titleText } }] },
    Name: { rich_text: [{ type: 'text', text: { content: fullName } }] },
    Email: { email: data.email },
    Location: { select: { name: data.location } },
    Age: { number: isFinite(data.age) ? data.age : null },
    // Notion "Occupation" property is filled from form field "profession"
    Occupation: { rich_text: [{ type: 'text', text: { content: data.profession } }] },
    InstagramAccount: data.instagram
      ? { rich_text: [{ type: 'text', text: { content: data.instagram } }] }
      : { rich_text: [] },
    FindingUs: { select: { name: data.referral } },
    findingUsOthers: data.referral === 'Others' && data.referralOther
      ? { rich_text: [{ type: 'text', text: { content: data.referralOther } }] }
      : { rich_text: [] },
    ID: { rich_text: [{ type: 'text', text: { content: idText } }] },
    'Created Date': { date: { start: data.timestamp || new Date().toISOString() } },
  };

  if (data.visitorId) {
    properties.visitorId = { rich_text: [{ type: 'text', text: { content: data.visitorId } }] };
  }

  if (data.bankAccount) {
    properties.bankAccount = { rich_text: [{ type: 'text', text: { content: data.bankAccount } }] };
  }

  // Optional created timestamp override by adding a simple property if it exists
  if (data.timestamp && properties['Created Date']) {
    // Leave to Notion created_time if not present as property; most DBs use system created_time
  }

  // The Notion SDK accepts various property input shapes; define a minimal cast target.
  type TitleInput = { title: Array<{ type: 'text'; text: { content: string } }> };
  type RichTextInput = { rich_text: Array<{ type: 'text'; text: { content: string } }> };
  type EmailInput = { email: string };
  type NumberInput = { number: number | null };
  type SelectInput = { select: { name: string } };
  type DateInput = { date: { start: string } };
  type NotionPropsShape = Record<string, TitleInput | RichTextInput | EmailInput | NumberInput | SelectInput | DateInput>;
  const res = await notion.pages.create({
    parent: { database_id: dbId },
    properties: properties as unknown as NotionPropsShape,
  });
  return res;
}

export async function listRegistrations(dbId: string, limit = 10) {
  const notion = getNotion();
  if (!notion) throw new Error('NOTION_TOKEN is not configured');

  const q = await notion.databases.query({
    database_id: dbId,
    page_size: Math.min(100, Math.max(1, limit)),
    sorts: [
      // Prefer system created_time if available
      { timestamp: 'created_time', direction: 'descending' },
    ],
  });

  // Map back to a minimal shape for verification
  return q.results.map((page: unknown) => {
    type NotionResult = {
      id: string;
      created_time: string;
      last_edited_time: string;
      properties: Record<string, unknown>;
    };
    const p = page as NotionResult;
    const props = (p.properties || {}) as Record<string, unknown>;
    const getText = (prop: unknown) => {
      const r = prop as { rich_text?: Array<{ plain_text?: string }> };
      return (Array.isArray(r?.rich_text) && r.rich_text[0]?.plain_text) || '';
    };
    const getTitle = (prop: unknown) => {
      const t = prop as { title?: Array<{ plain_text?: string }> };
      return (Array.isArray(t?.title) && t.title[0]?.plain_text) || '';
    };
    const emailProp = props.Email as { email?: string } | undefined;
    const ageProp = props.Age as { number?: number } | undefined;
    const locationProp = props.Location as { select?: { name?: string } } | undefined;
    const findingUsProp = props.FindingUs as { select?: { name?: string } } | undefined;
    return {
      id: p.id,
      title: getTitle(props.Title),
      name: getText(props.Name),
      email: (emailProp && typeof emailProp.email === 'string') ? emailProp.email : '',
      location: (locationProp && locationProp.select && typeof locationProp.select.name === 'string') ? locationProp.select.name : '',
      age: (ageProp && typeof ageProp.number === 'number') ? ageProp.number : null,
      occupation: getText(props.Occupation),
      instagram: getText(props.InstagramAccount),
      findingUs: (findingUsProp && findingUsProp.select && typeof findingUsProp.select.name === 'string') ? findingUsProp.select.name : '',
      findingUsOthers: getText(props.findingUsOthers),
      createdTime: p.created_time,
      lastEditedTime: p.last_edited_time,
    };
  });
}


