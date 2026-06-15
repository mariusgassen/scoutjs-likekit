## What & why

<!-- What does this change and why? Link any issue: Closes #123 -->

## Changes

-

## Verification

<!-- How did you check this? See CLAUDE.md "Verify a UI change" for the front-end steps. -->

- [ ] `npm run build:lib` && `npx tsc -p apps/web/tsconfig.json` && `npm run build:web`
- [ ] `mvn -B -ntp -f services/scoutkit-server/pom.xml verify`
- [ ] Added/updated tests where it made sense

## Notes for reviewers

<!-- Anything reviewers should know: trade-offs, follow-ups, screenshots. -->
