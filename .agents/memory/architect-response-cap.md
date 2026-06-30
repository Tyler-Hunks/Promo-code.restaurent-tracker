---
name: Architect response cap
description: Why architect (code_review) reviews can come back truncated and how to avoid it.
---

The architect / code_review `architect()` call echoes the full contents of every
file you pass in `relevantFiles` (and the git diff when `includeGitDiff: true`)
back into its result. On a large change this fills the response cap (~35k) with
echoed source before the actual analysis, so the useful findings get truncated.

**Why:** the result buffer is shared between echoed inputs and the model's
analysis; large inputs crowd out the output.

**How to apply:** pass only the few files that matter to the question, prefer
`includeGitDiff: false` when the files already contain the change, and split a
big review into focused calls rather than one call with many files.
