# FLN Onboarding Document — Jiya Singh

## 1. What is FLN?

Foundational Literacy and Numeracy (FLN) refers to the basic reading, writing, and mathematical skills children need to continue learning successfully. These skills include understanding written language, recognising numbers, counting, comparing quantities, and developing basic mathematical reasoning.

FLN is important because children build more advanced learning on these foundations. If a child struggles with basic concepts in the early years, it can become harder to understand later topics.

The FLN project aims to help teachers identify each child's current learning level, assess their understanding, and use assessment results to guide the next steps in learning. The goal is not only to conduct tests but also to understand what a child has learned and where additional support may be needed.

## 2. What do you understand by FLN as a system?

I understand FLN as a complete learning and assessment cycle rather than a collection of worksheets or tests.

A teacher needs to understand the current level of each student, assess their knowledge, interpret the results, and decide what should happen next. The assessment should help identify learning gaps instead of simply producing a score.

The system can be understood through these steps:

1. **Student profiling:** Maintain the student's relevant academic information and learning history.
2. **Assessment preparation:** Generate or select an appropriate assessment based on the curriculum and the student's learning needs.
3. **Assessment:** Let students attempt the questions, with teachers distributing and collecting the worksheets.
4. **Evaluation:** Process the answers and record the results.
5. **Diagnosis:** Identify the concepts the student has mastered and the areas where further learning may be needed.
6. **Next steps:** Use the results to guide further assessment or learning support.
7. **Progress tracking:** Keep a record of learning progress over time.

One important point is that assessment results should lead to meaningful action. A score alone does not explain why a student answered incorrectly. The system needs reliable curriculum mappings and assessment rules so that its conclusions are useful to teachers.

I also understand that the curriculum is not fixed permanently. The project has moved from earlier level counts to a 109-level framework, and the level numbering and prerequisite relationships may continue to change as the curriculum is refined. Code should therefore rely on shared curriculum data wherever possible rather than scattered hardcoded assumptions.

## 3. Current State of the Repository — What Has Been Done So Far

The repository is an npm-workspaces monorepo with separate parts for the frontend, the main backend, worksheet-specific backend functionality, and AI-related services.

The README describes the following major parts of the project:

* **Frontend:** React, Vite, and Tailwind CSS, used for the platform's user interface and dashboards.
* **Main backend:** Node.js, Express, TypeScript, and the native MongoDB driver.
* **Worksheet backend:** A separate JavaScript workspace for worksheet-related functionality.
* **AI services:** Python-based evaluation and OCR functionality that the main backend can invoke.
* **Student and assessment workflows:** Functionality for student profiles, assessment preparation, scanning, evaluation, and progress tracking.
* **Curriculum mapping:** `backend/src/config/curriculumMap.ts` maintains the mapping between curriculum levels, concepts, stages, age groups, and strands.
* **Question generation:** The repository is moving towards approved, concept-linked question templates while retaining legacy generation paths where required.

### Curriculum and Balvatika

The README identifies 109 curriculum levels and describes Stage 3, Balvatika, as levels 19–46. It also explains that Balvatika is currently being built out with curriculum entries, skill/subskill mappings, and authored question-generation content.

The question-generation pipeline has begun consuming approved templates, but the README also makes clear that the curriculum migration and real-world testing of newer levels are still ongoing.

Another important design decision is that level numbers should not be treated as permanent concept identifiers. The curriculum and prerequisite relationships may change, so new code should be designed to tolerate these changes.

### My understanding from working on the repository

My issue-linked contributions have helped me understand three practical areas of the project:

* Validation is important when creating student records, because invalid registration data can affect later workflows.
* Curriculum level limits need to remain consistent as the number of levels changes.
* Stage-related checks should use the shared curriculum mapping instead of repeating the same condition in different places.

These changes also showed me the value of testing boundary cases and registering tests so they can run as part of the repository's automated checks.

## 4. Gaps Observed in the Code

The following observations are based on the current README, the curriculum configuration, and the issues and pull requests I worked on. I have separated existing, documented limitations from areas that would benefit from further investigation.

### Gap 1: Curriculum migration and newer levels still need validation

**Relevant files and references:**

* `backend/src/config/curriculumMap.ts` — curriculum mapping.
* `frontend/src/data/skillProgressionMap.ts` — frontend skill and level mapping.
* `frontend/src/components/dashboards/FLNLevelReference.tsx` — curriculum level reference.
* `README.md`, “The Level Framework” section.

The README states that the curriculum has moved to 109 levels and that the migration is still in progress. It also notes that the most recently added levels have had the least real-world testing.

The earlier hardcoded 93-level ceiling affected multiple parts of the application, including progress calculations, level selectors, reporting, and question-bank validation. Issue #570 and PR #607 addressed these assumptions.

**Why this matters:** If different parts of the application use different curriculum limits or outdated level information, users may see incomplete lists or incorrect progress information. Future curriculum changes could also introduce similar inconsistencies if the same value is hardcoded again.

The dynamic ceiling has already been addressed in my merged PR. The remaining observation is that future curriculum changes should continue to be checked across the affected workflows.

### Gap 2: Balvatika stage identification must remain consistent

**Relevant files and references:**

* `backend/src/config/curriculumMap.ts` — `CURRICULUM_MAPPING` and `isBalvatikaStage(level)`.
* `backend/src/config/curriculumMap.test.ts` — stage-helper tests.
* Issue #612 and merged PR #629.

The curriculum mapping already stores a stage for each level. However, code that independently checks whether a level belongs to Stage 3 can duplicate the same rule in different places.

This was the issue addressed by adding `isBalvatikaStage(level)`, which uses the shared curriculum mapping. The merged change also includes a test for the Balvatika range across all 109 levels.

**Why this matters:** Duplicated stage checks can become inconsistent when the curriculum changes. A shared helper makes the rule easier to understand, reuse, and test.

The helper and its test have been added. A useful follow-up during future changes would be to check whether new stage-dependent logic consistently uses the shared helper.

### Gap 3: The appropriate length of a Balvatika diagnostic remains an open question

**Relevant reference:**

* `README.md`, “The Level Framework” section, particularly the discussion of Balvatika assessment length and mastery.

The README explicitly identifies the number of questions needed to establish mastery of a Balvatika concept as an unresolved design question. Assessing many concepts independently could create a worksheet that is too long for a young child to complete comfortably in one sitting.

The README also notes that FLN decisions are based on concept-level pass/fail outcomes rather than partial scores, which affects how any assessment threshold should be designed.

**Why this matters:** A diagnostic should collect enough evidence to support a meaningful conclusion without becoming unnecessarily long or tiring for the child. The number of questions and the assessment threshold therefore need to be considered together.

I would not treat this as a problem that should be solved by choosing an arbitrary question count in code. It requires agreement on the assessment approach and its educational basis first.

### Gap 4: Curriculum and prerequisite changes require careful handling

**Relevant files and references:**

* `backend/src/config/curriculumMap.ts`
* `frontend/src/data/skillProgressionMap.ts`
* `README.md`, “Where This Is Headed” section.

The README explains that the curriculum is evolving and that the intended prerequisite model is a directed acyclic graph with AND/OR relationships, rather than a simple one-parent-per-level tree. It also notes that level numbers are display labels and that existing question-bank IDs include level numbers.

**Why this matters:** Treating level numbers as permanent identifiers or assuming every concept has only one prerequisite path can make future curriculum changes difficult. It can also risk inconsistency between the curriculum data and the application logic.

This is an area where I would first discuss the intended design with the maintainers before proposing code changes, because the README specifically identifies this part of the system as being under redesign.

## 5. Ideas for the Project

The ideas below are connected to the observations in Section 4. They are possible areas for future work, not claims that these features are currently missing in every part of the application.

### Idea 1: Strengthen regression checks for curriculum-level changes

**What:** Continue improving automated checks for the current curriculum maximum and the handling of levels above the older 93-level limit.

**Why:** Curriculum changes can affect several parts of the application. A change that works in one component may leave another component using an outdated limit.

**How:** Review existing tests and identify important boundaries, including the first level, the Balvatika range, levels above 93, the current maximum, and values above the current maximum. Add focused tests where coverage is missing and use shared curriculum data instead of introducing new hardcoded limits.

This work should be tied to an existing issue or agreed with a maintainer before implementation.

### Idea 2: Keep stage-dependent logic connected to the curriculum mapping

**What:** Review future stage-dependent code to ensure it uses the central curriculum mapping and the shared helper where appropriate.

**Why:** Repeated stage checks can become inconsistent when the curriculum changes.

**How:** When working on an issue involving Balvatika or another stage, first inspect the existing helper and its tests. Add tests for the affected behaviour and avoid creating another independent definition of the same stage rule.

### Idea 3: Support evidence-based decisions about Balvatika assessment length

**What:** Contribute to the discussion and validation of an appropriate diagnostic length for Balvatika.

**Why:** The assessment needs to provide useful evidence of a child's understanding while remaining manageable for young learners.

**How:** Work with maintainers on the existing assessment-design question. If requested, help organise test cases or document the implications of different assessment approaches. Any implementation should follow an agreed educational and technical design rather than assuming a fixed number of questions per concept.

### Idea 4: Add tests around curriculum changes without assuming the curriculum is permanent

**What:** Review whether curriculum-dependent functionality has tests that remain meaningful when level mappings change.

**Why:** A test that merely repeats the same assumption as the implementation may not catch an incorrect curriculum mapping.

**How:** Where appropriate, test important expected behaviours and agreed boundaries explicitly. Keep tests focused on the requirement being checked, and coordinate with maintainers before changing curriculum rules or prerequisite logic.

I would prioritise these ideas according to the repository's active issues rather than start a separate feature without maintainer approval.

## 6. Your Contribution

My contributions to the FLN repository have focused on issue-linked changes, validation, curriculum consistency, and testing.

### PR #586 — Student registration validation tests

**Issue:** #397
**PR:** https://github.com/vicharanashala/fln/pull/586

I added unit/integration test coverage for student registration validation. The tests cover required fields, including `schoolId`, class-group validation, date-of-birth and age validation, Aadhaar normalization, and duplicate detection, including duplicates within bulk import.

Following review feedback, I added tests for a date of birth that results in an age above 20 and for a future date of birth. I also registered the test file through the `test:student-create` script so it could be run through the backend's test workflow.

The final PR had 14 passing tests and was merged. This work helped me understand how registration validation protects downstream workflows and why tests should verify real behaviour rather than only implementation details.

### PR #607 — Replace the hardcoded FLN level ceiling

**Issue:** #570
**PR:** https://github.com/vicharanashala/fln/pull/607

I worked on replacing hardcoded assumptions about the 93-level curriculum with a limit derived from the current curriculum data. The changes covered multiple areas, including dashboard and reporting components, diagnostic workflow, scanning-related UI, and question-bank validation and tests.

I also updated the relevant boundary tests to verify that levels above 93 could be handled and that the current maximum was accepted while values above it were rejected.

This contribution helped me understand how a curriculum change can affect multiple parts of a large repository and why shared configuration and regression tests are important.

### PR #629 — Add the Balvatika stage helper

**Issue:** #612
**PR:** https://github.com/vicharanashala/fln/pull/629

I added `isBalvatikaStage(level)` in `backend/src/config/curriculumMap.ts`. The helper uses the existing `CURRICULUM_MAPPING` stage data to determine whether a level belongs to Stage 3, Balvatika.

I also added tests for the helper across the curriculum and, following review feedback, added an explicit check for the expected Balvatika range of levels 19–46. I registered the test through the `test:balvatika-stage` script.

This contribution helped me understand the importance of centralising shared curriculum logic and writing tests that verify the expected behaviour independently of the implementation.

### What I learned

Across these contributions, I learned to:

* Read the relevant code and issue requirements before making changes.
* Check how a small change can affect multiple parts of a repository.
* Use review feedback to identify missing test cases and improve validation.
* Test boundary conditions rather than relying only on normal inputs.
* Register tests so they can run through the project's automated checks.
* Prefer shared configuration and reusable helpers over repeated hardcoded rules.
* Keep proposed changes aligned with the repository's current priorities and ask maintainers before making assumptions about curriculum or assessment design.

I plan to continue contributing through issue-linked work, with a focus on understanding the existing design, testing changes carefully, and keeping implementations aligned with the project's evolving curriculum.
