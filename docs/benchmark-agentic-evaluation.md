# Agentic benchmark evaluation

Generated: 2026-09-20T06:37:44.777Z
Cases evaluated: 20
Runtime mode: demo_adapter
LLM reasoning enabled in run: false

| Case | Customer | Transaction | Pattern | Verdict | Initial → final confidence | Evidence request | Action | Route | Sources |
|---|---|---|---|---|---:|---|---|---|---|
| HHG-001 | C12382 | 3514030 | out_of_region_use | uncertain | 76% → 76% | none | MONITOR_ACCOUNT | auto | demo_adapter, case_memory |
| HHG-002 | C11891 | 3478782 | card_not_present_fraud | uncertain | 83% → 83% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-003 | C08623 | 3530164 | out_of_region_use | uncertain | 89% → 89% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-004 | C08106 | 3583227 | card_testing | fraud | 94% → 94% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-005 | C02923 | 3523199 | card_not_present_new_device | uncertain | 80% → 80% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-006 | C07297 | 3476682 | card_not_present_new_device | uncertain | 91% → 91% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-007 | C09933 | 3514948 | out_of_region_use | uncertain | 86% → 86% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-008 | C13171 | 3558054 | card_testing | uncertain | 89% → 89% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-009 | C08299 | 3581141 | card_not_present_fraud | uncertain | 85% → 85% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-010 | C10434 | 3506725 | card_not_present_new_device | fraud | 95% → 95% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-011 | C11923 | 3583368 | card_testing | fraud | 96% → 96% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-012 | C05876 | 3553342 | card_testing | uncertain | 74% → 74% | none | MONITOR_ACCOUNT | auto | demo_adapter, case_memory |
| HHG-013 | C07671 | 3526826 | card_not_present_new_device | uncertain | 89% → 89% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |
| HHG-014 | C13487 | 3478561 | card_not_present_new_device | uncertain | 61% → 61% | none | MONITOR_ACCOUNT | auto | demo_adapter, case_memory |
| HHG-015 | C03042 | 3464869 | card_not_present_new_device | uncertain | 90% → 90% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-016 | C09988 | 3534820 | card_not_present_new_device | fraud | 95% → 95% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-017 | C04570 | 3450629 | card_not_present_fraud | uncertain | 75% → 75% | none | MONITOR_ACCOUNT | auto | demo_adapter, case_memory |
| HHG-018 | C02354 | 3491361 | out_of_region_use | fraud | 93% → 93% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-019 | C07987 | 3503878 | card_not_present_new_device | fraud | 95% → 95% | none | BLOCK_CARD | L1 | demo_adapter, case_memory |
| HHG-020 | C12265 | 3509359 | card_not_present_new_device | uncertain | 80% → 80% | none | STEP_UP_AUTH | auto | demo_adapter, case_memory |

## Run interpretation

The report records the bounded evidence sources, agent recommendation, deterministic approval route, evidence request behavior, and case write-back result for every official benchmark case. In demo mode, write-back is intentionally reported as simulated rather than successful. Enable TigerGraph MCP/RESTPP and the LLM provider to produce a live run.
