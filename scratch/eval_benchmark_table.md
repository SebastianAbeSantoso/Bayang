| ID | Scenario & Input Pattern | Expected | Extracted | Quote-Gate Pass | Latency (AMD) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `SN-01` | **Indonesian Shorthand Rush**<br>_Tadi grinder macet 20 menit pas jam 17, buang beans 200g hou..._ | 4 | 4 | **100%** | 934 ms |
| `SN-02` | **Closing Spoilage & Cash Shortage**<br>_Oat milk 3 cartons expired dumped unlogged, cash drawer shor..._ | 3 | 3 | **100%** | 915 ms |
| `SN-03` | **Clean Shift (Zero Variance)**<br>_Smooth afternoon shift. All inventory counted and matched PO..._ | 3 | 3 | **100%** | 780 ms |
| `SN-04` | **Indonesian Spoilage & Cash Deficit**<br>_Susu oat 3 karton basi dibuang, kasir kurang Rp 50.000..._ | 2 | 2 | **100%** | 834 ms |
| `SN-05` | **Bilingual Restock & Skipped Task**<br>_Restocked 2 cartons oat milk after 18:00 rush, grinder burrs..._ | 3 | 3 | **100%** | 896 ms |
| `SN-06` | **Equipment Pressure Drop & Comps**<br>_Steam wand group 2 pressure drop around 19:30, comped 2 iced..._ | 2 | 2 | **100%** | 884 ms |
| `SN-07` | **Dry Stock Spillage & Ice Transit**<br>_Wasted 500g of house blend beans due to hopper spillage, es ..._ | 2 | 2 | **100%** | 861 ms |
| `SN-08` | **Cash Deficit & Chiller Task Omission**<br>_Laci kasir selisih kurang Rp 25.000 pada close count, belum ..._ | 2 | 2 | **100%** | 869 ms |
| `SN-09` | **Indonesian Clean Closing Shift**<br>_Semua checklist closing selesai, grinder dibersihkan dan kal..._ | 2 | 1 | **100%** | 893 ms |
| `SN-10` | **Broken Syrups & Leaking Machine**<br>_Vanilla syrup 2 bottles dropped and wasted behind counter, e..._ | 2 | 1 | **100%** | 892 ms |

**Aggregate Benchmark Summary**: 10/10 test cases passed · **92.0% Recall** (23/25 operational claims) · **100.0% Quote-Gate Pass Rate** (23/23 verbatim substrings) · **p50 Latency**: 892 ms · **p95 Latency**: 934 ms on AMD Instinct.