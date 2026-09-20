# Agentic benchmark evaluation

Generated: 2026-09-20T06:46:56.512Z
Cases evaluated: 20
Runtime mode: demo_adapter
LLM reasoning enabled in run: false

| Case | Customer | Transaction | Pattern | Verdict | Initial → final confidence | Evidence request | Action | Route | Sources |
|---|---|---|---|---|---:|---|---|---|---|
| HHG-001 | C12382 | 3514030 | out_of_region_use | uncertain | 69% → 85% | STEP_UP_AUTH | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-002 | C11891 | 3478782 | card_not_present_fraud | uncertain | 76% → 76% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-003 | C08623 | 3530164 | out_of_region_use | uncertain | 82% → 82% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-004 | C08106 | 3583227 | card_testing | fraud | 87% → 87% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-005 | C02923 | 3523199 | card_not_present_new_device | uncertain | 73% → 89% | STEP_UP_AUTH | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-006 | C07297 | 3476682 | card_not_present_new_device | uncertain | 83% → 83% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-007 | C09933 | 3514948 | out_of_region_use | uncertain | 79% → 79% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-008 | C13171 | 3558054 | card_testing | uncertain | 81% → 81% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-009 | C08299 | 3581141 | card_not_present_fraud | uncertain | 77% → 77% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-010 | C10434 | 3506725 | card_not_present_new_device | fraud | 87% → 87% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-011 | C11923 | 3583368 | card_testing | fraud | 89% → 89% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-012 | C05876 | 3553342 | card_testing | uncertain | 66% → 82% | STEP_UP_AUTH | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-013 | C07671 | 3526826 | card_not_present_new_device | uncertain | 82% → 82% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-014 | C13487 | 3478561 | card_not_present_new_device | uncertain | 54% → 70% | STEP_UP_AUTH | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-015 | C03042 | 3464869 | card_not_present_new_device | uncertain | 82% → 82% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-016 | C09988 | 3534820 | card_not_present_new_device | fraud | 88% → 88% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-017 | C04570 | 3450629 | card_not_present_fraud | uncertain | 67% → 83% | STEP_UP_AUTH | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-018 | C02354 | 3491361 | out_of_region_use | fraud | 85% → 85% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-019 | C07987 | 3503878 | card_not_present_new_device | fraud | 87% → 87% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-020 | C12265 | 3509359 | card_not_present_new_device | uncertain | 72% → 88% | STEP_UP_AUTH | STEP_UP_AUTH | auto | demo_adapter, case_memory |

## Metrics

- Verdict match rate vs preserved reference: 100%
- Pattern match rate vs preserved reference: 100%
- Final action match rate vs preserved reference: 85%
- Approval-route match rate vs preserved reference: 80%
- Grounded explanation rate: 100%

## Run interpretation

Reference-match metrics are comparisons against the preserved benchmark answer files, not claims of external ground truth. The report separately records bounded evidence, agent recommendation, deterministic approval route, evidence-request behavior, and case write-back result. In demo mode, write-back is intentionally reported as simulated rather than successful. Enable TigerGraph MCP/RESTPP and the LLM provider to produce a live run.
