# Operational pains Indian hospitals face in the outpatient and follow-up journey (with an elder lens)

Compiled 2026-11-15. India only. This file describes problems and does not propose solutions.

**How to read each finding.** Every bullet carries a tag block: `[Stage | Setting | Sample | Data/pub date | Elder-specific?]`.
- Stage codes: S1 Find doctor · S2 Book · S3 Register · S4 Wait/navigate · S5 Consultation · S6 Tests · S7 Reports · S8 Medicines · S9 Follow-ups · S10 Payments/insurance · S11 Digital health IDs/teleconsult · S12 Emergencies · S0 Other.
- "Elder: Y" means the sample is 60+ (or a reported 60+/70+ stratum). "Elder: partial" means an age effect or elder share is reported but the sample is not 60+ only. "Elder: N" means general population.
- Source quality: "verified" means I opened the page or PDF and read the number. "search-extracted" means the number came from a search-engine extract of the page and I could not open the full page, usually because of HTTP 403. Treat search-extracted numbers as lower confidence.

---

## Q1. OPD crowding: daily footfall at major public hospitals, patients per doctor per day, consultation length

### Takeaway
The flagship public hospitals each handle roughly 8,000–15,000 OPD visits a day. AIIMS New Delhi recorded about 48.4 lakh outpatient visits network-wide in 2024-25, and PGIMER about 27–28 lakh a year. Audits and studies of district and super-specialty OPDs find about 80 to over 300 patients per doctor per day, with most consultations under 5 minutes and often around 2 minutes. None of these sources breaks down OPD volume or consultation time by age, except one older Safdarjung report that puts elders at about 10–15% of OPD patients.

### Cited Findings
**Footfall: AIIMS New Delhi**
- In 2024-25 the AIIMS New Delhi network and its centres recorded **48,43,572 outpatient visits**, 3,61,236 admissions and 2,57,451 surgeries and procedures. The main hospital alone accounted for **22,68,551 visits** across general OPD, specialty clinics and emergency. A senior doctor put daily footfall at **"14,000–15,000 on average"**. The institute has 4,178 beds at about 83% occupancy, 452 faculty vacancies, about 750 resident-doctor vacancies and a **35% overall vacancy rate**. The 171st report of the Parliamentary Standing Committee on Health (presented 18 Mar 2026) cites **waits of up to 5 years** for complex procedures such as neurosurgery. `[S4/S0 | AIIMS New Delhi | whole-institution administrative data | report FY2024-25; article 3 Sep 2026 | Elder: N | verified (news article quoting the annual report)]` — [Free Press Journal](https://www.freepressjournal.in/india/15000-patients-1000-surgeries-5-year-waits-the-complex-world-of-aiims-delhi)
- UNI rounds the same year to "more than 50 lakh outpatient visits". `[S4 | AIIMS New Delhi | FY2024-25 | Sep 2026 | Elder: N | search-extracted]` — [UNI India](https://www.uniindia.com/national/health-aiims-delhi-opd-visits/192577)
- A Parliament reply gives **100,51,620 OPD** and 5,00,464 IPD patients for **all AIIMS combined** in 2023-24. This is not the Delhi-only figure. `[S4 | all AIIMS | FY2023-24 | Elder: N | search-extracted]` — [Lok Sabha reply AS164](https://eparlib.nic.in/bitstream/123456789/2978464/1/AS164_c7eDZx.pdf)
- The newer (regional) AIIMS group reported 129.98 lakh OPD visits in 2024-25 and 144.96 lakh in 2025-26. `[S4 | new AIIMS group | 11 Nov 2026 | Elder: N | search-extracted, secondary]` — [Omnicuris](https://www.omnicuris.com/medshots/daily_updates/new-aiims-hospitals-record-over-6-crore-opd-consultations_11-Nov-26_08-02)

**Footfall: PGIMER Chandigarh**
- OPD footfall rose from **14,23,487 in 2021 to 27,05,020 in 2023**, a 90% increase, and daily influx passed **10,000**. In response, 32 departments asked for 182 assistant-professor posts and faculty were ordered to be at their OPDs by 9:15 am. `[S4 | PGIMER, Chandigarh | administrative data | 25 Mar 2024 | Elder: N | verified]` — [The Tribune](https://www.tribuneindia.com/news/chandigarh/pgi-opd-footfall-doubles-in-2-years-604152)
- In 2024 PGIMER logged more than **28 lakh OPD registrations**. `[S3/S4 | PGIMER | Dec 2024 | Elder: N | search-extracted]` — [Hindustan Times via Magzter](https://magzter.com/stories/newspaper/Hindustan-Times-Chandigarh/PGI-LOGGED-OVER-28-LAKH-OPD-REGISTRATIONS-THIS-YEAR)
- The 2018-19 figure was 28,76,257 outpatients and 98,710 admissions. This is older data and appears to be counted on a different basis. `[S4 | PGIMER | FY2018-19 | Elder: N | search-extracted]` — [MoHFW Annual Report 2018-19, Ch. 15](https://mohfw.gov.in/sites/default/files/15%20Chapter%20275AN2018-19.pdf)
- Another report gives "9,000–10,000 patients visiting the OPDs every day" with waits of "two–three hours". The publication date could not be confirmed. `[S4 | PGIMER | accessed 2026-11-15 | Elder: N | search-extracted]` — [The Tribune](https://www.tribuneindia.com/news/chandigarh/to-meet-rush-pgi-doctors-told-to-reach-opds-on-time-603357)

**Footfall: Safdarjung (VMMC), New Delhi**
- Safdarjung sees **8,000–9,000 OPD patients a day**, of whom **about 10–15% are elderly**. Senior citizens "often faced problems in accessing the medical facilities due to overcrowding" and "have to wait or stand in queues". MRI had a waiting time of more than 3 months, and the geriatric OPD ran only 9:30 am–12:30 pm. `[S4/S6 | Safdarjung Hospital, Delhi (2,900 beds) | 27 Jul 2019 (older) | Elder: partial (elder share) | verified]` — [The Hans India](https://www.thehansindia.com/news/national/special-opd-for-elderly-patients-opened-at-safdarjung-hospital-549989)

**Patients per doctor per day, and consultation length**
- **CAG audit, Uttar Pradesh (Report No. 2 of 2019, period 2013-18).** Average OPD cases per doctor per day rose **24% in district hospitals (DH/JH), from about 83 to 103**, 20% in district women's hospitals and 12% in CHCs. Over the same period OPD load rose 33% while average OPD doctors per DH/JH went only from 22 to 23. **86% of DH/JH patients, 69% of DWH patients and 50% of CHC patients got consultations under 5 minutes**, and 11% of DH/JH patients got 2 minutes or less (30 lakh patients). The government accepted that "due to acute shortage of specialist doctors time given to every patient in OPD was less than 05 minutes". `[S5 | 11 DH/JHs, 8 DWHs, 22 CHCs, UP | records of lakhs of OPD cases | 2013-18; report 2019 | Elder: N | verified (PDF text; chart values parsed from PDF, approximate)]` — [CAG UP Report 2 of 2019, Ch. 2](https://cag.gov.in/uploads/download_audit_report/2019/Chapter_2_Out_patient_Services_of_Report_No_2_of_2019_Hospital_Management_in_Uttar_Pradesh_Government_of_Uttar_Pradesh.pdf)
- **CAG audit, Jharkhand (2018).** General medicine OPDs in six district hospitals ran **79–325 patients per doctor per day**, with consultation times of **1–5 minutes**. `[S5 | 6 DHs, Jharkhand | 2018 report | Elder: N | search-extracted]` — [CAG Jharkhand Ch. 2](https://cag.gov.in/uploads/download_audit_report/2018/6-Chapter%202-06231b674e7e260.93463705.pdf)
- **CAG audit, J&K (Report No. 2 of 2025, OPD data 2016-22).** **58% of OPD patients were examined in under 5 minutes** and fewer than 2% got more than 15 minutes. In tertiary hospitals 59.69 lakh consultations were under 5 minutes, 73.35 lakh were 5–10 minutes and 11.22 lakh were over 10 minutes. In district hospitals the figures were 65.24 lakh, 29.06 lakh and 3.71 lakh. In an audit patient survey (n=750), 436 (58%) reported consultations of up to 5 minutes. `[S5 | J&K tertiary, district, SDH and CHC | 2016-22; article 1 Apr 2026 | Elder: N | verified (news report of the CAG audit)]` — [Daily Excelsior](https://www.dailyexcelsior.com/cag-flags-long-waits-short-consultations-in-jk-opds/)
- **IGIMS Patna, super-specialty OPDs (2018 data).** Gastroenterology, neurology and oncology OPDs each saw **more than 200 patients per working day**, at **about 2 minutes per consultation**. The super-specialty average was 2.2 minutes and surgical disciplines about 10 minutes. There were 3,59,099 OPD visits in 2018. `[S5 | IGIMS Patna, Bihar, 9 clinics | 2018 data; pub 26 Sep 2019 | Elder: N | verified (abstract)]` — [Pandey et al., IJCMPH 2019](https://www.ijcmph.com/index.php/ijcmph/article/view/5276)
- **International benchmark (Irving et al., BMJ Open, Nov 2017).** India's primary-care consultation length was about **2 minutes (2015 data)**. Across 67 countries (178 studies, 28.5 million consultations) the range ran from 48 seconds in Bangladesh to 22.5 minutes in Sweden. The authors linked short consultations to polypharmacy, antibiotic overuse and poor communication. `[S5 | India primary care | data 2015; pub 8 Nov 2017 (older) | Elder: N | search-extracted; journal page returned 403]` — [Medical Dialogues](https://medicaldialogues.in/doctors-in-india-see-patients-for-just-two-minutes-study); [Outlook India](https://www.outlookindia.com/national/indian-doctors-only-spend-2-minutes-with-patients-which-is-among-the-worst-in-th-news-304118); [paper](https://bmjopen.bmj.com/content/7/10/e017902)

### Inferences
- The CAG audits from UP, Jharkhand and J&K and the IGIMS study agree: a consultation of about 2–5 minutes is the norm in Indian public OPDs, not the exception. Older patients have multimorbidity and need more explanation (see Q6), so the time constraint plausibly falls hardest on them. No source measures this directly.
- Footfall figures are counted in different ways (registrations, visits, daily averages, network versus main campus) and should not be compared across hospitals without noting the definition.

### Gaps
- **NOT FOUND:** consultation length or patients-per-doctor broken down by patient age (60+).
- **NOT FOUND:** the share of OPD visits by patients aged 60+ at AIIMS New Delhi or PGIMER. The only figure is Safdarjung's 10–15% from 2019.
- I could not open the AIIMS New Delhi or PGIMER annual report PDFs. Figures come from news reports quoting them.
- A NIRF 2025 disclosure lists "average OPD attendance 15000" for AIIMS New Delhi in calendar 2023, but the unit (per day) was not confirmed, so I left it out of the findings ([NIRF](https://www.nirfindia.org/nirfpdfcdn/2025/pdf/Medical/IR-D-N-15.pdf)).

---

## Q2. Registration time, waiting time, total OPD turnaround, and share of time spent waiting

### Takeaway
Registration itself usually takes minutes: under 5 minutes for most patients, and about 10 minutes for offline counters in one 2024 time-motion study. In big public hospitals, however, the total journey from arrival to consultation can run to hours: 260 minutes in a 2026 North India tertiary study, where 76% of the journey was spent waiting and consultation was under 5% of it. CAG survey data from J&K show a third of tertiary and district hospital patients needed more than 15 minutes just to register. None of these studies reports results for elders separately.

### Cited Findings
- **Stage-wise OPD flow, government tertiary teaching hospital, North India** (2,200+ beds, 150 OPDs, 20 specialty OPDs studied). Mean time from arrival to consultation was **260.4 minutes**. Of this, **242.8 minutes (76.2%) was waiting to be called** and the consultation was **12.8 minutes (under 5%)**. Arrival to completion at the pharmacy took **318.6 minutes**, with pharmacy dispensing alone taking 119.4 minutes. The root causes identified were "registration-counter misallocation", "lack of patient-guidance infrastructure" and a "centralised, multi-stop pharmacy". Patient-reported timing was combined with direct time-motion observation at the pharmacy, and the stage times overlap. `[S3/S4/S5/S8 | govt tertiary teaching hospital, North India (unnamed) | n=255 (convenience) | data May–Jun 2026; pub 30 Oct 2026 | Elder: N (no age breakdown) | verified (abstract)]` — [Kumari, IJCMPH 2026;13(11):6667-71](https://www.ijcmph.com/index.php/ijcmph/article/view/16572)
- **Time-motion study, ABHA online versus offline registration** at a tertiary care hospital (site not named; authors from SN Medical College, Agra). Offline registration took a **mean 10.37 minutes** in total, of which **about 9.4 minutes was waiting**. ABHA-linked online registration took 4.15 minutes, including about 1 minute of waiting and about 2 minutes of app download and data entry. The authors flagged digital literacy as an unmeasured confounder. `[S3/S11 | tertiary hospital, likely Agra, UP | n=40 (20+20) | data 1–21 Oct 2024; pub 9 Apr 2025 | Elder: N | verified]` — [Ranjan et al., Cureus 2025;17(4):e81970](https://pmc.ncbi.nlm.nih.gov/articles/PMC12063933/)
- **CAG J&K patient survey** (Report No. 2 of 2025). Only **43% of respondents (325/750) registered in under 5 minutes**. 141 took 6–10 minutes, 115 took 11–15 minutes and 169 took more than 15 minutes. **34% of tertiary and district hospital patients took more than 15 minutes to register.** From registration to consultation, 357 waited up to 15 minutes, 196 waited 16–30 minutes, 145 waited 31–60 minutes and 52 waited more than 60 minutes. **62% of tertiary-hospital patients waited more than 30 minutes** after registering. `[S3/S4 | J&K public facilities, all levels | n=750 | survey during audit to Mar 2022; article 1 Apr 2026 | Elder: N | verified (news report)]` — [Daily Excelsior](https://www.dailyexcelsior.com/cag-flags-long-waits-short-consultations-in-jk-opds/)
- **GMCH Chandigarh OPD patient survey.** The most-reported problems were **overcrowding (53.8%)** and **long waiting time (49.0%)**. Overall, 70.9% were satisfied, 16.6% less satisfied and 12.5% not satisfied. Per the search extract, 237 respondents were aged over 60, but the abstract gives no results by age. `[S4 | GMCH-32, Chandigarh | n=1,069 | data Apr–Dec 2025; pub 30 Oct 2026 | Elder: partial (elders sampled, no age-wise results seen) | verified (abstract)]` — [Kumar, Goel, Sharma, IJCMPH 2026](https://www.ijcmph.com/index.php/ijcmph/article/view/16684)
- **Registration and billing study, tertiary hospital in Raigad, Maharashtra.** At the registration counter, 75% of patients finished OPD/IPD paperwork in under 5 minutes, 19% took 5–10 minutes and 6% took 10–15 minutes. `[S3 | tertiary hospital, Raigad | sample not captured | data Aug 2021–Jan 2022; pub 2023 | Elder: N | search-extracted]` — [Khot et al., BVMJ 2023](https://mcpune.bharatividyapeeth.edu/media/pdfs/journals/bvmj.in/journal/khot_2023.pdf)
- **Government medical college OPD, Nanded, Maharashtra (older study).** Patients waited a total of **75.5 minutes**. Contributing factors included the "registration clerk not attending duty on time". `[S3/S4 | GMC Nanded | 2014 (older) | Elder: N | search-extracted]` — [Aswar et al., IJHSR 2014](https://mail.ijhsr.org/IJHSR_Vol.4_Issue.4_April2014/4.pdf)
- **Official estimate (not a measured study).** The Health Ministry says ABHA "Scan & Share" cut registration queue time from **30–40 minutes to 5–10 minutes**. NHA reported **more than 2 crore** Scan & Share OPD tokens by February 2024, at about 1 lakh patients a day. AIIMS New Delhi reported 73,700 Scan & Share tokens in 2023. `[S3/S11 | national | Feb 2024 / 2023 | Elder: N | search-extracted; this is a ministry claim]` — [Indian Pharma Post (2 crore tokens)](https://www.indianpharmapost.com/digitisation/abha-based-scan-and-share-service-facilitates-2-crore-instant-opd-registrations-nationwide-15323); [MoHFW press info](https://www.mohfw.gov.in/press-info/7908); [Lokmat Times (AIIMS)](https://www.lokmattimes.com/national/aiims-successfully-implements-abha-based-app-to-cut-down-waiting-time-for-opd-patients)

### Inferences
- The binding constraint is the wait between registration and consultation, plus the pharmacy, not the registration transaction itself. In the 2026 North India study, waiting was about 76% of the arrival-to-consultation time. Older patients who stand in queues for hours (the Safdarjung 2019 quote) face a physical burden that these studies do not measure.
- The "30–40 to 5–10 minute" Scan & Share claim is a government estimate. The only independent time-motion comparison found is Ranjan et al. 2025 with n=40, which reports 10.4 versus 4.2 minutes.

### Gaps
- **NOT FOUND:** any time-motion or waiting-time study in India that reports results separately for patients aged 60+.
- **NOT FOUND:** a large multi-site Indian waiting-time study. All studies found are single sites with n=40–1,069, apart from the CAG survey (n=750).

---

## Q3. Front-desk and staff time spent helping patients with forms, digital processes, ABHA creation, kiosks or navigation

### Takeaway
**NOT FOUND: no Indian study directly measures front-desk or staff minutes spent helping patients with forms, ABHA creation, kiosks or navigation.** The closest proxies are (a) CAG audit figures for patient load per registration counter (averaging 277–460 patients per counter per day in UP district hospitals in 2017-18, and up to 792), (b) the NHM norm of 3–5 minutes per registration, and (c) qualitative reports that older patients cannot complete Aadhaar-OTP-based ABHA steps without staff help.

### Cited Findings
- **PROXY, counter load (verified).** In 2017-18 the average daily patient load per registration counter was **460 across 11 UP district hospitals**, with Saharanpur at 792 and Allahabad at 787. It was **277 across 8 district women's hospitals** (Saharanpur 595, Gorakhpur 402) and ranged from **87 to 428 in 22 CHCs**. The audit observed "long queues of patients" because of heavy load at counters. The government replied that it would increase the number of counters. `[S3 | UP DHs/DWHs/CHCs | facility records | 2017-18; report 2019 | Elder: N]` — [CAG UP Report 2 of 2019, Ch. 2](https://cag.gov.in/uploads/download_audit_report/2019/Chapter_2_Out_patient_Services_of_Report_No_2_of_2019_Hospital_Management_in_Uttar_Pradesh_Government_of_Uttar_Pradesh.pdf)
- **PROXY, counter load (search-extracted).** In Jharkhand in 2018-19, average daily load per registration counter reached **560 at DH Hazaribag** and **389 at DH Palamu**. Manipur's audit says high load per counter meant patients and attendants "had to spend extra time waiting". Haryana's audit noted queues at registration counters in DH Panipat and DH Hisar in April 2022. `[S3 | state CAG audits | 2018-22 | Elder: N | search-extracted; exact chapter PDFs not opened]` — [CAG audit report listing (2024 health chapter)](https://cag.gov.in/uploads/download_audit_report/2024/Chapter-3-Healthcare-Services-0676d3322b33346.02416031.pdf)
- **PROXY, staffing norm (search-extracted).** As quoted in CAG state audits, the NHM Assessor's Guidebook (Vol. 1, 2013) "estimates the average time required for registration to be **3–5 minutes per patient**, which roughly works out to about **12–20 patients per hour per counter**". One audit converts this to a benchmark of **120 patients per counter per day** (3 minutes per patient over a 6-hour OPD). Against this benchmark, the UP averages of 277–460 are roughly 2.3–3.8 times the norm load (my arithmetic). `[S3 | national norm | 2013 | Elder: N | search-extracted]` — [CAG audit chapter (2024)](https://cag.gov.in/uploads/download_audit_report/2024/Chapter-3-Healthcare-Services-0676d3322b33346.02416031.pdf)
- **PROXY, qualitative, elder-specific.** The medical head of Jayanagar General Hospital, Bengaluru, said (Feb 2026) that "many older patients bring phones not linked to Aadhaar", so "the OTP never arrives". "Server downtime has also slowed registration." Patients without smartphones can have staff or a Common Service Centre create the ABHA at the counter. `[S3/S11 | Jayanagar General Hospital, Bengaluru | anecdotal | article 10 Nov 2026 | Elder: Y (qualitative)]` — [Deccan Chronicle](https://www.deccanchronicle.com/360-degree/switching-hospitals-in-bengaluru-how-an-abha-id-keeps-your-medical-history-with-you-2003193)
- **PROXY, qualitative (secondary source).** At Gandhi Hospital, Hyderabad, the ABDM-linked digital OPD "created hurdles". A 57-year-old patient without a smartphone was asked to download the app. The article reports that hospitals sometimes compel ABHA creation for OPD registration although it is voluntary, and that counter support is "minimal" even where helpdesks exist. `[S3/S11 | Gandhi Hospital, Hyderabad | anecdotal | Sep 2025 | Elder: partial | secondary blog summarising news]` — [OC Academy](https://www.ocacademy.in/blogs/digital-opd-system-gandhi-hospital-challenges)
- **PROXY, weak.** A student policy brief asserts that "hospital staff usually spend around 1–2 hours on the screen to enter and update data" at primary care level. It cites no primary measurement. `[S11 | national, primary care | no sample | Nov 2025 | Elder: N | verified text; weak source]` — [Sapnani, ISPP policy brief](https://www.ispp.org.in/wp-content/uploads/2025/11/shalu-sapnani-policy-brief-final_compressed.pdf)
- **PROXY, digital step time.** In the only time-motion study found, ABHA online registration needed about 2 minutes of patient-side app download and data entry, and **digital literacy was not measured**. `[S3/S11 | tertiary hospital, likely Agra | n=20 online | Oct 2024 | Elder: N]` — [Ranjan et al., Cureus 2025](https://pmc.ncbi.nlm.nih.gov/articles/PMC12063933/)
- **PROXY, guidance infrastructure.** The 2026 North India time-motion study names "lack of patient-guidance infrastructure" and "registration-counter misallocation" as root causes of delay. `[S3/S4 | govt tertiary, North India | n=255 | 2026 | Elder: N]` — [Kumari, IJCMPH 2026](https://www.ijcmph.com/index.php/ijcmph/article/view/16572)

### Inferences
- When counters carry 2–4 times the NHM-norm load, any extra minutes spent helping an older patient through OTP, app or ABHA steps come out of a queue that is already over capacity. This is an inference: no study quantifies those minutes.
- The OTP-to-Aadhaar-linked-phone dependency is a specific failure point that hospital staff report for older patients.

### Gaps
- **NOT FOUND:** measured staff minutes per patient for form-filling, ABHA creation, kiosk help or wayfinding at any Indian hospital.
- **NOT FOUND:** the number of registration or help-desk staff per 1,000 OPD patients at AIIMS, PGIMER or Safdarjung.
- **NOT FOUND:** kiosk usage or failure rates by age at Indian hospitals.
- **NOT FOUND:** the share of Scan & Share or ABHA registrations completed by patients aged 60+.

---

## Q4. No-shows and missed appointments in Indian hospitals and teleconsultations

### Takeaway
**No reliable peer-reviewed Indian no-show rate for general OPD was found.** One 2026 Punjab/Chandigarh tertiary study has "frequency" in its title but sampled only 100 patients who had already missed appointments, so it reports reasons rather than a rate. The main reasons were forgetfulness, lack of reminders and a complex booking system. Teleconsultation follow-up in COVID-era programmes reached only about half to two-thirds of scheduled patients. The widely circulated Indian no-show rates of 20–32% come from vendor marketing, not studies.

### Cited Findings
- **Missed appointments, tertiary hospital OPD** (authors from the Punjab Institute of Liver and Biliary Sciences, Mohali, and PGIMER, Chandigarh). The **sample was 100 patients who had missed appointments**, so no denominator or rate is reported despite the title. Leading reasons on a 5-point Likert scale were forgetfulness (mean 4.05), complexity of the booking system (4.02) and lack of appointment reminders (4.00). **76% had received reminders and 24% had not.** **Only 18% attempted to reschedule.** Ease of cancelling or rescheduling was rated low (mean 2.74). Missed appointments were highest in Paediatrics (18%) and Ophthalmology (16%). Bookings were mostly by mobile app (34%) or telephone (27%). 61% of no-shows were aged 25–40. Distance was not significant (p=0.525) and forgetfulness was correlated with missing (r=0.392). `[S2/S9 | tertiary hospital, Punjab/Chandigarh | n=100 no-shows | data Mar–Aug 2024; pub Jul 2026 | Elder: N (60+ shown in chart, share not extractable) | verified (PDF text)]` — [Khaliq et al., IJCMPH 2026;13(7):3850-60](https://www.ijcmph.com/index.php/ijcmph/article/download/15981/9477/81235)
- **Psychiatry dropout, PGIMER Chandigarh.** The paper cites Indian psychiatric outpatient dropout rates of **21.3–59.3%** from earlier literature. In its own sample, dropouts took **42.9% of prescribed medication versus 92.6%** among regular attendees. Dropouts were older (mean 40.2 versus 35.5 years, p=0.006) and less often had family-supervised medication (33.3% versus 48.5%). `[S9/S8 | PGIMER psychiatry | n=272 (72 dropouts) | pub 15 Feb 2021 | Elder: N]` — [Grover et al., Indian J Psychiatry 2021;63(1):41-51](https://pmc.ncbi.nlm.nih.gov/articles/PMC8106432)
- **Teleconsultation follow-up, AIIMS New Delhi neurology (COVID).** In 10 working days, 968 patients were listed for tele-follow-up and **successful communication was made with 50.3%** (27.7% the patient directly, 22.6% family members). By subtraction, about half were not reached (my arithmetic). `[S9/S11 | AIIMS New Delhi neurology | n=968 | 2020 | Elder: N]` — [medRxiv preprint](https://www.medrxiv.org/content/10.1101/2020.07.13.20153171v1.full.pdf)
- **eSanjeevani.** The platform does not publish no-show or repeat-visit data. An independent review notes the data "cannot determine unique users or repeat visit patterns". It records more than 327,000 diabetes follow-ups by 2023. `[S11/S9 | national telemedicine | accessed 2026-11-15 | Elder: N]` — [ICTworks](https://www.ictworks.org/esanjeevani-shows-what-actually-works/)

### Inferences
- Forgetfulness and missing reminders top the reasons even among working-age no-shows. Older patients with memory impairment (29.4% in the Udupi elderly sample, Q6) plausibly face higher risk, but this is not measured.
- In tele-follow-up, family members answered 22.6% of the successful AIIMS calls, which suggests caregivers are a key point of contact.

### Gaps
- **NOT FOUND:** a peer-reviewed no-show rate (numerator over denominator) for any Indian hospital OPD, overall or for patients aged 60+.
- **NOT FOUND:** no-show rates for eSanjeevani or private teleconsultation platforms.
- **Excluded as unreliable:** vendor-blog claims of a "32% median private-hospital no-show rate", "OPD 22–28%, follow-up 30–38%", and a Delhi hospital cutting no-shows "from 32% to 11%". None cites a primary source ([example vendor page](https://caller.digital/blog/ai-call-bot-hospital-appointment-reminders-rescheduling-india)).
- A cancer-centre tele-follow-up report (2,686 scheduled, 1,783 contacted in 9 working days, Natl Med J India 2022) appeared in search, but I could not confirm its URL, so it is not cited above.

---

## Q5. Follow-up drop-off and loss to follow-up (NCD clinics, cataract, oncology, post-discharge), elder-specific where possible

### Takeaway
In the government's own India Hypertension Control Initiative, only **51% of registered patients returned in a follow-up quarter**. Patients aged 70+ returned at about the same rate (52.5%), so about 47.5% of the 70+ group did not return in that window. After free cataract surgery, more than half of non-attenders at the one-month review were aged 65+, and forgetting (20%) and lack of an escort (8%) were among the cited barriers. Oncology loss to follow-up runs at about 25–28% in single-centre audits.

### Cited Findings
- **IHCI sentinel cohort.** Of **21,895 adults with hypertension** registered from Jan 2018 to Jun 2019 at 24 public facilities (8 secondary hospitals, 8 CHCs, 8 PHCs in Punjab, MP, Maharashtra and Telangana), only **11,274 (51%) returned for a follow-up visit in Jul–Sep 2019**. **By age:** 30–49 years 44.7% returned. **50–69 years (n=13,198) 53.5% returned.** **70+ years (n=4,361) 52.5% returned**, and their BP control among returners rose from 23.8% to 55.3%. Overall BP control among returners rose from 26.3% to 59.8%. The authors conclude that high loss to follow-up limits population impact. `[S9 | IHCI public facilities, 4 states | n=21,895 | data 2018-19; pub online 23 Dec 2020 | Elder: Y (70+ stratum) | verified]` — [Kaur et al., J Clin Hypertens 2021;23(4):720-9](https://pmc.ncbi.nlm.nih.gov/articles/PMC8678731)
- **Mumbai Hypertension Project (private sector).** About 51% of 6,752 enrolled patients followed up over 14 months, and BP control improved only among those who did. `[S9 | private clinics, Mumbai | n=6,752 | pub 2022 | Elder: N | search-extracted]` — [J Hum Hypertens 2022](https://link.springer.com/10.1038/s41371-022-00754-1)
- **Free cataract surgery, missed one-month review** (Mission for Vision network). The sample was **851 patients who missed follow-up**, of whom **53% were aged 65 or older**. Barriers: **forgot 20%**, household or livelihood commitments 16%, **no escort 8%**, financial or transport 2%. **22% were unwilling to attend future visits**, and 38% said they needed support, mostly transport (62% of that group). Reported adherence differed by site: camps 59%, hospitals 37%, other 4%. `[S9 | 15 locations, 14 states | n=851 non-attenders | pub 31 May 2025 | Elder: Y (majority 65+) | verified (abstract)]` — [Vishwakarma et al., IJCMPH 2025;12(6)](https://www.ijcmph.com/index.php/ijcmph/article/view/13834)
- **Aravind Eye Hospital, Madurai (older data).** The one-month follow-up rate after **86,776 cataract surgeries was 85.6%**, so about 14.4% did not return. Lower follow-up was linked to complications, reoperations and poorer discharge vision. `[S9 | Aravind, Madurai, TN | n=86,776 | 2015 data; JCRS 2019 (older) | Elder: N (cataract cohort, mostly older, not stratified) | search-extracted]` — [Gupta et al. (abstract record)](https://www.aminer.cn/pub/5cff8b793a55ac38cc40e3c5/predictors-of-patient-compliance-with-follow-up-visits-after-cataract-surgery)
- **Oncology outpatient audit, South India tertiary centre.** **28% were lost to follow-up** across treatment phases and a further 33% died during the study period. `[S9 | South Indian tertiary oncology | pub 2024 | Elder: N | search-extracted]` — [APJCC 2024;9(1):97-102](https://doi.org/10.31557/apjcc.2024.9.1.97-102)
- **Teenagers and young adults with cancer** (4 centres, Rajasthan and MP). **24.4% abandoned therapy**, mainly because of financial burden. This is not elder-specific and is included only for the oncology baseline. `[S9/S10 | multi-institution | ESMO Asia 2020 abstract | Elder: N | search-extracted]` — [ESMO Asia 2020 Abstract 298P](https://oncologypro.esmo.org/meeting-resources/esmo-asia-virtual-congress-2020/abandonment-of-treatment-in-teenagers-and-young-adults-with-cancer-a-multi-institutional-survey?page=35)

### Inferences
- The IHCI age strata show older patients are not more likely than middle-aged patients to drop out. About half of every adult age group misses the follow-up quarter, so the problem is system-wide. Older patients still have the most to lose from a missed follow-up because they start with worse BP control (23.8% controlled at registration among 70+ returners).
- In cataract follow-up, "no escort" and "forgot" point to dependence on family logistics for older patients.

### Gaps
- **NOT FOUND:** post-discharge follow-up attendance rates for elderly inpatients in India, meaning attendance at the first post-discharge OPD visit.
- **NOT FOUND:** loss-to-follow-up rates in NPCDCS/NP-NCD diabetes clinics broken down by 60+ age.
- **NOT FOUND:** oncology loss to follow-up specific to patients aged 60+ in India.
- A community diabetes and hypertension programme reporting **16.5% 12-month retention** appeared in search, but I could not confirm its source URL, so it is not cited.

---

## Q6. Prescription and discharge-instruction misunderstanding, illegible handwriting, polypharmacy, medication errors and adherence among elderly Indians

### Takeaway
More than a third of outpatients at a Kolkata public tertiary hospital had poor understanding of their prescriptions. Only 40% understood dosing frequency, abbreviations such as BD, TDS and HS were often misunderstood, and patients over 50 scored worse. About half of older Indians are on polypharmacy (pooled 49%) and about 28% receive potentially inappropriate medicines. Among rural elders with hypertension plus diabetes, 55.6% were non-adherent. Illegible handwriting led to a 2025 High Court order requiring capital-letter prescriptions.

### Cited Findings
**Comprehension**
- **Kolkata public tertiary hospital OPDs** (cardiology, medicine, paediatrics, ENT). **36.8% had poor composite understanding** of prescription instructions (95% CI 32.1–41.8) and only 20% had "excellent" understanding. **Only 40% had a good grasp of frequency**, and abbreviations **BD, TDS and HS were often left unexplained and misunderstood**. **Patients aged over 50 scored worse than those 50 or under (P=0.03).** Patients with more than secondary education were 2.4 times more likely to have excellent understanding (44% versus 18.7%). Audited prescriptions were 96% legible and 86% complete. `[S5/S8 | public tertiary hospital, Kolkata | n=380 patients/caregivers | data Feb–Apr 2023; pub 2025 | Elder: partial (>50 effect) | verified (news summary of the journal article)]` — [Das, Kotal, Chatterjee, Indian J Pharmacol 2025;57:83-9, via Medical Dialogues](https://medicaldialogues.in/amp/medicine/news/handwritten-prescriptions-pose-barrier-to-patient-understanding-indian-study-finds-150068)
- **Mumbai tertiary hospital pharmacy outpatients.** **52% had "no knowledge to little knowledge"** of their prescribed medication, and age and literacy were significantly associated with knowledge. `[S8 | tertiary hospital, Mumbai | year not captured (IJCMPH, c. 2019) | Elder: partial | search-extracted]` — [John & Bhate, IJCMPH](https://www.ijcmph.com/index.php/ijcmph/article/view/5450)
- **Discharge summary legibility (older study).** In an audit of 200 emergency discharge case sheets in Chennai, legibility of the diagnosis, prescription and discharge-instruction sections was **66%, 76% and 65%**. `[S8/S12 | Sundaram Medical Foundation, Chennai | n=200 | pub 2008 (older) | Elder: N | search-extracted]` — [Int J Emerg Med 2008](https://pmc.ncbi.nlm.nih.gov/articles/PMC2657266)
- **PGIMER neurosurgery discharge instructions (older study).** Of 37 patients assessed, 35 showed good comprehension and 33 good compliance. `[S8/S9 | PGIMER | n=58 interviewed | data 2010; pub 2016 (older) | Elder: N | search-extracted]` — [Asian J Neurosurg 2016;11(4):372-7](https://thieme-connect.de/products/ejournals/abstract/10.4103/1793-5482.144190)

**Illegible handwriting**
- **Punjab & Haryana High Court, 27 Aug 2025.** The court directed doctors to write prescriptions and medico-legal reports in **capital letters** until digital prescriptions are in place. It held legible prescriptions part of the right to health under Article 21 and sought a policy to computerise prescriptions within 2 years. The trigger was an unreadable medico-legal report in a bail case. Haryana's health department then ordered capital or bold letters in all handwritten prescriptions. `[S5/S8 | Punjab, Haryana, Chandigarh | court order | Aug–Oct 2025 | Elder: N]` — [Medical Dialogues](https://medicaldialogues.in/news/health/doctors/legible-prescriptions-a-fundamental-right-punjab-and-haryana-hc-directs-doctors-to-use-capital-letters-154332); [The Tribune](https://www.tribuneindia.com/news/haryana/haryana-orders-doctors-to-write-prescriptions-in-capital-letters-to-prevent-medication-errors); [The Star (Reuters/AFP copy), 1 Oct 2025](https://www.the-star.co.ke/news/world/2025-10-01-indian-court-tells-doctors-to-fix-their-handwriting)
- GMCH-32 Chandigarh mandated capital-letter or digital prescriptions after the order. `[S8 | GMCH-32, Chandigarh | 2025 | Elder: N | search-extracted]` — [Medical Dialogues](https://medicaldialogues.in/news/health/doctors/gmch-32-mandates-doctors-to-prescribe-in-capital-letters-or-digital-form-155215)

**Polypharmacy and potentially inappropriate medicines (elder-specific)**
- **Meta-analysis of 27 Indian studies.** Pooled prevalence among older Indians was **49% for polypharmacy** (95% CI 42–56), **31% for hyperpolypharmacy** and **28% for potentially inappropriate medication (PIM)**. PIM use was **35% in people aged 70+**. By region, PIM use was 23% in the East, 33% in the West, 17.8% in the North and 32% in the South. `[S8 | India pooled | 27 studies | pub May 2021 | Elder: Y | search-extracted]` — [Frontiers in Pharmacology 2021 (PMC8173298)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8173298)
- **Six-city door-to-door study** (Delhi, Kolkata, Chennai, Guwahati, Patna, Ujjain; ICMR Centre for Ageing and Mental Health with VMMC-Safdarjung and others; Scientific Reports). Among 600 people aged 60+ (2,741 prescribed medicines), **polypharmacy was 33.7%**, ranging from 57% in Guwahati to 11.7% in Ujjain. **173/600 (about 28.8%) had a PIM** and **20.3% had potential prescribing omissions**. 65.3% of self-medicators lacked proper knowledge about self-medication. `[S8 | 6 cities | n=600, 60+ | article 13 Feb 2025 | Elder: Y | verified]` — [ThePrint](https://theprint.in/health/28-in-every-100-elderly-indians-prescribed-potentially-harmful-medication-door-to-door-study-of-6-cities/2491394)
- **Mumbai tertiary hospital, hospitalised elderly (STOPP/START).** **6.4% had inappropriate prescriptions and 9.2% had omissions.** Higher comorbidity and multiple drugs were linked to higher error risk. `[S8 | Mumbai tertiary | n=250 geriatric inpatients | ISPOR 2018 (older) | Elder: Y | search-extracted]` — [ISPOR 2018 abstract](https://www.ispor.org/heor-resources/presentations-database/presentation/ispor-2018/study-of-prescription-errors-and-associated-factors-in-the-geriatric-patient-population-of-a-tertiary-care-hospital-in-india)

**Adherence (elder-specific)**
- **Rural elders with hypertension plus type 2 diabetes** (5 PHC areas, Udupi district, Karnataka). **55.6% (200/360) were non-adherent** on a modified Hill-Bone scale. Mean age was 69. Within the sample, 29.4% had memory impairment, 47.8% vision impairment and 37.2% multiple functional impairments, all associated with non-adherence. Person-related factors such as forgetfulness and poor understanding had the strongest correlation (r=−0.444). `[S8/S9 | rural Udupi | n=360, 60+ | data Dec 2019–Feb 2021; pub 13 Jul 2023 | Elder: Y | verified]` — [Jeyalakshmi et al., Patient Prefer Adherence 2023;17:1641-56](https://pmc.ncbi.nlm.nih.gov/articles/PMC10351531/)
- **Elderly diabetics at a tertiary OPD in Mangalore.** The text reports **72% adherent** on the MARS scale. About 27% reported forgetting medication, about 22% stopped when they felt better, and about 13% stopped when they felt worse. **Caution:** the reported median MARS score of 3 falls in the paper's own "non-adherent" band, which conflicts with the 72% figure. `[S8 | Yenepoya Medical College Hospital, Mangalore | n=101, >60 | data Apr–Aug 2022; pub 7 Aug 2023 | Elder: Y | verified; internally inconsistent]` — [Udupa et al., Cureus 2023;15(8):e43098](https://pmc.ncbi.nlm.nih.gov/articles/PMC10483026/)
- **WHO SAGE wave 2, India.** Average medication adherence was **51%** among 2,840 people with one or more NCDs. The sample is not limited to people aged 60+, and the authors say it may underestimate non-adherence. `[S8 | national survey | n=2,840 | pub 2023 | Elder: partial | search-extracted]` — [Frontiers in Pharmacology 2023](https://frontiersin.org/articles/10.3389/fphar.2023.1183818/full)

### Inferences
- Comprehension falls with age (the >50 effect in Kolkata) and with lower education. Polypharmacy is common in older Indians (33.7–49%). Taken together, older patients carry the most complex regimens with the least understanding. This is a synthesis of separate studies, not a single measurement.
- The Kolkata study found 96% of prescriptions legible yet 36.8% poorly understood, so illegibility is not the only comprehension problem. Unexplained abbreviations and frequency instructions are a separate failure.

### Gaps
- **NOT FOUND:** a study of prescription or discharge-instruction comprehension restricted to Indian patients aged 60+.
- **NOT FOUND:** a national LASI-based medication-adherence rate for older adults. Searches returned no LASI adherence figure.
- **NOT FOUND:** Indian data on medication errors at the home or post-discharge stage for elderly patients, such as wrong dose or duplicate drugs after discharge.
- **NOT FOUND:** the prevalence of illegible prescriptions in Indian OPDs measured systematically in the 2020s. There is court and news attention, but no audit figure was found apart from the 2008 Chennai discharge audit.

---

## Q7. Readmissions: 30-day rates, elder-specific rates, payer penalties and quality metrics

### Takeaway
An NHA analysis of PM-JAY claims (59.6 lakh claims, 2018-19) found about **1 in 20 patients readmitted within 30 days** and about 1 in 50 within 7 days. Rates rose with age and were 8.4% for medical cases versus 3.2% for surgical cases. In a geriatric unit at CMC Vellore the 30-day readmission rate was **5.2%**, and 41% of those readmissions were potentially avoidable. **No PM-JAY or insurer penalty linked to readmission was found.**

### Cited Findings
- **NHA analysis of PM-JAY claims** (59.6 lakh claims, 36.8 lakh beneficiaries, launch on 23 Sep 2018 to Nov 2019). About **1 in 20 patients were readmitted within 30 days** and about **1 in 50 within 7 days**. The 30-day rate was **8.4% for medical** versus **3.2% for surgical** packages. State rates ranged from about 1% (Arunachal Pradesh, Karnataka) to more than 11% (Kerala). **Rates rose with patient age** (no numeric 60+ rate was found), were higher for men, and were slightly higher in private hospitals. General medicine and paediatric medical management had the highest rates. `[S9/S10/S12 | PM-JAY national claims | n=59.6 lakh claims | data 2018-19; reported 13 Jul 2020 | Elder: partial (age gradient, no 60+ number) | search-extracted; page returned 403]` — [Lokmat Times / ANI](https://www.lokmattimes.com/national/pmjay-1-in-20-patients-readmitted-within-30-days-of-discharge-1-in-50-patients-within-7-days)
- **Economic Survey 2020-21, using PM-JAY data.** Readmissions cost more on average than original admissions (**INR 19,295 versus INR 12,652**) and stayed longer (**7.5 versus 6.6 days**). `[S10 | PM-JAY | pub Jan 2021 | Elder: N | search-extracted; page returned 403]` — [Economic Survey 2020-21 Vol 1, p.180](https://www.indiabudget.gov.in/economicsurvey/ebook_es2021/files/basic-html/page180.html)
- **Geriatrics department, CMC Vellore.** Retrospective audit of 2,698 geriatric admissions, mean age 75.9. The **30-day unplanned readmission rate was 5.18%** (140 readmissions). Early readmissions (0–7 days) were 41.4% and late (8–30 days) 58.5%. **41.4% were potentially avoidable.** Median time to readmission was 10 days. **Median cost of an avoidable readmission was INR 44,000 (about USD 602).** Causes were progression of an existing disease (55.7%) or new unrelated disease (43.2%). Advanced age predicted avoidable early readmission (OR 1.11 per year). General-ward admission (OR 2.99), insulin and antidepressants were also associated with early readmission. The paper has internal inconsistencies, including the OR reported for age and the avoidable share of new-disease readmissions. `[S9/S12 | CMC Vellore, TN (patients from TN, AP, Kerala) | n=2,698 admissions / 140 readmissions | data May 2015–May 2020; pub 14 Oct 2022 | Elder: Y | verified]` — [Samuel et al., JFMPC 2022;11(9):5246-53](https://pmc.ncbi.nlm.nih.gov/articles/PMC9730993)
- **PM-JAY rules adjacent to readmission (not penalties).** PM-JAY packages generally include complications arising from surgery. Some state health agencies describe a 15-day post-hospitalisation benefit. A CAG audit's anti-fraud checks flag claims for the same patient at multiple hospitals in overlapping periods. None of these is a readmission penalty. `[S10 | PM-JAY / SHA Uttarakhand / CAG | 2022–23 | Elder: N | search-extracted]` — [SHA Uttarakhand: Guidelines on Payment for Special Cases](https://sha.uk.gov.in/ScannedDocs/WebSite/Uploads/CLAIM_ADJ/Guidelines%20on%20Payment%20for%20Special%20Cases.pdf); [SHA Uttarakhand Claims FAQ](https://sha.uk.gov.in/ScannedDocs/WebSite/Uploads/CLAIM_ADJ/Claims%20Adjudication%20FAQs.pdf); [CAG PM-JAY audit, Ch. V (2023)](https://cag.gov.in/uploads/download_audit_report/2023/09_Chapter-V-064d22bab412c53.02505839.pdf)
- **PM-JAY enforcement, general context, not readmission-specific.** Since launch, 3,167 hospitals were found to have violated norms. 1,114 were de-empanelled, 1,504 fined a total of ₹122 crore, and 549 suspended. `[S10 | national | accessed 2026-11-15 | Elder: N | search-extracted]` — [Outlook India](https://www.outlookindia.com/healthcare-spotlight/union-health-ministry-cracks-down-on-fraud-in-ab-pmjay-3167-hospitals-found-guilty)
- **Private hospital self-report.** Even Hospital, Bengaluru, claims "sub-1% unplanned readmissions" among more than 1,000 insurance-linked claimants. This is a press claim and is not audited. `[S9/S10 | Even Hospital, Bengaluru | press release | Elder: N]` — [Indian Pharma Post](https://www.indianpharmapost.com/hospitals/even-hospital-earns-nabh-6th-edition-accreditation-within-first-year-of-operation-21426)

### Inferences
- The PM-JAY national figure of about 5% and the CMC geriatric figure of about 5.2% are similar, but neither is a population-representative 60+ rate. The PM-JAY figure would also miss readmissions to non-empanelled or out-of-scheme hospitals.
- At CMC, 41% of geriatric readmissions were avoidable and each cost a median INR 44,000. That is the clearest hospital-side cost figure found for readmissions of older patients.

### Gaps
- **NOT FOUND:** any PM-JAY, IRDAI or private-insurer financial penalty tied to 30-day readmission in India.
- **NOT FOUND:** confirmation that NABH's accreditation indicator set includes a 30-day readmission metric. The NABH standards document was not retrieved.
- **NOT FOUND:** a numeric 30-day readmission rate for patients aged 60+ from PM-JAY data. The source states only that rates rise with age.
- I could not open the original NHA working paper on PM-JAY readmissions. The figures above are from wire-agency coverage.

---

## Q8. Cost figures: what these problems cost hospitals, and staffing ratios at registration counters

### Takeaway
Hard cost figures are scarce. The only hospital-side figures found are the cost of readmissions: a median **INR 44,000 per avoidable geriatric readmission** at CMC Vellore, and an average **INR 19,295 per PM-JAY readmission versus INR 12,652** for an original admission. For registration staffing, the best data are CAG counter loads of **277–460 patients per counter per day** (averages, UP 2017-18), against an NHM-derived norm of about **120 per counter per day**. **No Indian estimate was found for the cost of no-shows, waiting time or front-desk assistance.**

### Cited Findings
- **Avoidable geriatric readmission cost:** median INR 44,000 (about USD 602). `[S9 | CMC Vellore | n=140 readmissions | pub 2022 | Elder: Y | verified]` — [Samuel et al., JFMPC 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9730993)
- **PM-JAY readmission cost:** average INR 19,295 versus INR 12,652 for original admissions, with stays of 7.5 versus 6.6 days. `[S10 | PM-JAY | pub Jan 2021 | Elder: N | search-extracted]` — [Economic Survey 2020-21, p.180](https://www.indiabudget.gov.in/economicsurvey/ebook_es2021/files/basic-html/page180.html)
- **Registration counter loads:** UP district hospitals averaged 460 patients per counter per day (up to 792), district women's hospitals 277 (up to 595) and CHCs 87–428, all in 2017-18. `[S3 | UP | 2017-18 | Elder: N | verified]` — [CAG UP Report 2 of 2019](https://cag.gov.in/uploads/download_audit_report/2019/Chapter_2_Out_patient_Services_of_Report_No_2_of_2019_Hospital_Management_in_Uttar_Pradesh_Government_of_Uttar_Pradesh.pdf). In Jharkhand in 2018-19, DH Hazaribag carried 560 and Palamu 389. `[search-extracted]` — [CAG audit chapter](https://cag.gov.in/uploads/download_audit_report/2024/Chapter-3-Healthcare-Services-0676d3322b33346.02416031.pdf)
- **Registration norm:** 3–5 minutes per patient, or 12–20 patients per hour per counter (NHM Assessor's Guidebook 2013), which one audit converts to 120 per counter per day. `[S3 | national norm | Elder: N | search-extracted]` — [CAG audit chapter](https://cag.gov.in/uploads/download_audit_report/2024/Chapter-3-Healthcare-Services-0676d3322b33346.02416031.pdf)
- **Clinical staffing strain:** AIIMS New Delhi has a 35% overall vacancy rate, with 452 faculty and about 750 resident vacancies (2026). `[S0 | AIIMS New Delhi | Sep 2026 | Elder: N | verified]` — [Free Press Journal](https://www.freepressjournal.in/india/15000-patients-1000-surgeries-5-year-waits-the-complex-world-of-aiims-delhi). PGIMER departments sought 182 extra assistant-professor posts to cope with OPD growth. `[S0 | PGIMER | Mar 2024 | Elder: N | verified]` — [The Tribune](https://www.tribuneindia.com/news/chandigarh/pgi-opd-footfall-doubles-in-2-years-604152)
- **Time-saving claim, not a cost:** the Health Ministry claims Scan & Share saved about 3.3 crore person-hours of patient queue time. This is an official estimate with no published method. `[S3/S11 | national | 2024 | Elder: N | search-extracted]` — [MoHFW press info](https://www.mohfw.gov.in/press-info/7908)

### Inferences
- In UP, the gap between actual counter load and the NHM-derived norm is about 2.3–3.8 times. That is the most concrete measure of front-desk under-capacity found. It is my arithmetic on figures that are both cited.

### Gaps
- **NOT FOUND:** the cost of missed appointments or no-shows to any Indian hospital, in rupees or in lost slots. Vendor blogs cite an "₹85 lakh" figure with no method ([vendor page](https://hashnode-hub.vercel.app/posts/68b539ced15bdf5b3ba6e81f)), and it is excluded.
- **NOT FOUND:** the cost of registration or help-desk staff time per patient, or the cost of ABHA creation at the counter.
- **NOT FOUND:** registration-counter staffing ratios at AIIMS New Delhi, PGIMER or Safdarjung.
- **NOT FOUND:** the hospital-side cost of patient misunderstanding of medication, for example through medication-error admissions.

---

## Q9. Cross-cutting: which numbers are elder-specific, and where is there no data?

### Takeaway
Elder-specific Indian numbers exist mainly for **polypharmacy and PIMs, medication adherence, IHCI follow-up by age, cataract non-attendance and geriatric readmission**. **Nothing elder-specific was found for OPD waiting or registration time, consultation length, front-desk assistance, no-show rates, or teleconsultation drop-off.**

### Cited Findings
**Elder-specific (60+, or a reported 65+/70+ stratum)**
- IHCI follow-up: 52.5% of patients aged 70+ returned (n=4,361). `[S9]` — [Kaur et al. 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8678731)
- Cataract follow-up non-attenders: 53% aged 65+; forgot 20%, no escort 8%. `[S9]` — [Vishwakarma et al. 2025](https://www.ijcmph.com/index.php/ijcmph/article/view/13834)
- Polypharmacy 49% and PIM 28% (pooled); PIM 35% in 70+. `[S8]` — [Frontiers Pharmacol 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8173298)
- Six-city study: polypharmacy 33.7% and PIM 28.8% among 600 people aged 60+. `[S8]` — [ThePrint 2025](https://theprint.in/health/28-in-every-100-elderly-indians-prescribed-potentially-harmful-medication-door-to-door-study-of-6-cities/2491394)
- Rural elders with hypertension plus diabetes: 55.6% non-adherent; 29.4% memory impairment, 47.8% vision impairment. `[S8/S9]` — [Jeyalakshmi et al. 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10351531/)
- Geriatric 30-day readmission 5.18%, 41.4% avoidable, median cost INR 44,000. `[S9/S12]` — [Samuel et al. 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9730993)
- Elder share of OPD at Safdarjung: 10–15% (2019). `[S4]` — [The Hans India 2019](https://www.thehansindia.com/news/national/special-opd-for-elderly-patients-opened-at-safdarjung-hospital-549989)
- Qualitative: older patients' phones are not Aadhaar-linked, so the ABHA OTP fails (Bengaluru, 2026). `[S3/S11]` — [Deccan Chronicle 2026](https://www.deccanchronicle.com/360-degree/switching-hospitals-in-bengaluru-how-an-abha-id-keeps-your-medical-history-with-you-2003193)

**Age effect reported, but the sample is not 60+ only**
- Prescription comprehension was worse at age over 50 (P=0.03). `[S8]` — [Das et al. 2025 via Medical Dialogues](https://medicaldialogues.in/amp/medicine/news/handwritten-prescriptions-pose-barrier-to-patient-understanding-indian-study-finds-150068)
- PM-JAY readmission rises with age (no number). `[S9]` — [Lokmat/ANI 2020](https://www.lokmattimes.com/national/pmjay-1-in-20-patients-readmitted-within-30-days-of-discharge-1-in-50-patients-within-7-days)

### Inferences
- The evidence base on hospital-side operational pain is almost entirely age-blind. Studies of the parts of the journey where frailty and digital barriers would matter most (registration, waiting, navigation, digital ID, teleconsult) do not disaggregate by age.

### Gaps (consolidated NOT FOUND list)
- Waiting or registration time for patients aged 60+: **NOT FOUND**.
- Consultation length for patients aged 60+: **NOT FOUND**.
- Front-desk or staff minutes spent assisting patients (forms, ABHA, kiosks, navigation): **NOT FOUND**. Proxies are given in Q3.
- No-show rate (any age) from a peer-reviewed Indian study: **NOT FOUND**.
- Teleconsultation (eSanjeevani) no-show or repeat-visit rate, any age or 60+: **NOT FOUND**.
- Post-discharge first-follow-up attendance among elderly inpatients: **NOT FOUND**.
- Prescription or discharge comprehension in a 60+-only sample: **NOT FOUND**.
- LASI-based national medication adherence among older adults: **NOT FOUND** (searches returned none).
- Readmission penalties from PM-JAY or insurers: **NOT FOUND**.
- Cost of no-shows or of front-desk assistance to Indian hospitals: **NOT FOUND**.
- Search snippets mentioned a geriatric OPD satisfaction study (n=262 patients over 60, 63% not satisfied, 96.1% wanting a separate geriatric OPD) and a Dehradun radiation-oncology OPD study (84.1% of time spent waiting). I could not reliably match either to a source URL, so neither is cited in the findings.
