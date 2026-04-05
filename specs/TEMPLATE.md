# [Feature Name]

**Status**: Draft | Ready | In Progress | Done
**Created**: YYYY-MM-DD
**PR**: #XXX (when implemented)

## What & Why

[2-3 sentences: What does this feature do and why does it matter?]

## User Stories

- **As a** [user type], **I want to** [action], **so that** [benefit]
- **As a** [user type], **I want to** [action], **so that** [benefit]

## Acceptance Criteria

- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]
- [ ] Given [context], when [action], then [outcome]

## Technical Approach

### Files to Create/Modify

```
app/
  [locale]/
    new-page/
      page.tsx          # New page
components/
  NewComponent.tsx      # New component
lib/
  new-helper.ts         # New utility
```

### Data Model

```typescript
type NewFeature = {
  id: string;
  // ...
};
```

### API (if applicable)

```
POST /api/new-endpoint
GET /api/new-endpoint/:id
```

## Testing

- [ ] Unit tests: [what to test]
- [ ] Integration tests: [what to test]
- [ ] E2E tests: [what user flow to test]

## i18n

- [ ] Add translation keys to `messages/zh.json` and `messages/en.json`
- [ ] Test in both locales

## Security Checklist

- [ ] Input validation
- [ ] Auth/authorization (if needed)
- [ ] Rate limiting (if needed)
- [ ] No sensitive data exposed

## Open Questions

- [ ] Question 1?
- [ ] Question 2?

## Implementation Notes

(Fill this during/after coding with gotchas, decisions, etc.)
