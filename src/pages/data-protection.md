---
layout: ../layouts/DataProtectionLayout.astro
title: HyperProbe data protection overview | Hyperprobe
description: HyperProbe data protection overview
---

# HyperProbe data protection overview

This document outlines how HyperProbe complies with the European Union General Data Protection Regulation (Regulation (EU) 2016/679, "GDPR") and the UK GDPR. It describes our data protection architecture, technical and organizational security measures (TOMs), data processing roles, and client-configurable privacy controls.

---

## 1. Overview & Commitment to GDPR

HyperProbe is designed to support the strict security, privacy, and regulatory requirements of enterprise engineering and DevOps teams. In accordance with the GDPR’s **Accountability Principle (Article 5(2))** and **Privacy by Design and by Default (Article 25)**, HyperProbe implements technical safeguards, bounded data collection, and customizable redaction mechanisms to protect personal data throughout the telemetry lifecycle.

Organizations subject to GDPR can deploy HyperProbe with confidence, backed by verifiable controls and an executable Data Processing Addendum (DPA).

---

## 2. GDPR Roles & Responsibilities

Data protection obligations depend on whether data pertains to platform user administration or application runtime telemetry.

| Context | Role | Details |
| :--- | :--- | :--- |
| **Runtime Diagnostic Telemetry (Snapshots, Variables, Traces)** | **Customer = Data Controller**<br>**HyperProbe = Data Processor** | The customer determines where probes are placed, what code paths are inspected, and what runtime variables may be collected. In cloud-managed deployments, HyperProbe processes this diagnostic data solely on documented customer instructions. |
| **Self-Hosted / In-VPC Deployments** | **Customer = Controller & Processor**<br>**HyperProbe = Software Provider** | When HyperProbe is self-hosted within the customer’s private cloud or on-premise infrastructure, **all telemetry, snapshots, and persistent databases remain entirely within the customer’s perimeter**. HyperProbe systems do not access or transmit customer telemetry. |


---

## 3. Data Flow & Processing Boundaries

HyperProbe is a non-breaking, on-demand diagnostic tool. It is **not** a continuous network tap, bulk database scraper, or unbounded memory collector.

### Categories of Data Processed

1. **Account & Administrative Data**: Email address, SSO identity tokens.
2. **Probe Definitions (Metadata)**: File path, line number, environment tag, activation criteria, capture limits, and conditional expressions.
3. **Diagnostic Snapshots (Ephemeral Application State)**:
   - Local variable names and values captured at the moment of probe execution.
   - Stack frame references (call stack).
   - Distributed APM trace identifiers (e.g., OpenTelemetry, Datadog trace IDs).

### Architectural Boundaries & Data Flow

```
+--------------------------------------------------------------------------+
| Customer Application Runtime                                             |
|  [HyperProbe Agent (SDK)]                                                |
|    │                                                                     |
|    ├─► Evaluates dynamic probe condition (in-process)                    |
|    ├─► Applies key-name & value regex redaction (in-flight)             |
|    └─► Bounds snapshot size (MAX_DEPTH, MAX_SNAPSHOT_SIZE)               |
+──────────────────────────────────────────────────┬───────────────────────+
                                                   │ gRPC (TLS)
                                                   ▼
+──────────────────────────────────────────────────────────────────────────+
| HyperProbe Control & Data Plane (Cloud or Customer VPC)                 |
|  [Logger Broker]                                                         |
|    │                                                                     |
|    ▼ NATS JetStream (Encrypted)                                          |
|  [Logger-Consumer]                                                       |
|    │                                                                     |
|    ▼                                                                     |
|  [PostgreSQL Storage] (Encrypted at rest, time-bound retention)          |
|    ▲                                                                     |
|    │ tRPC / HTTPS                                                        |
|  [Backend & Dashboard / IDE Extension]                                   |
+--------------------------------------------------------------------------+
```

---

## 4. Technical and Organizational Measures (TOMs - Article 32)

To ensure a level of security appropriate to the risk, HyperProbe enforces the following controls:

### In-Flight Privacy & Redaction Controls

HyperProbe provides native, in-process redaction controls to prevent personal identifiable information (PII) and credentials from being captured:

* **Key-Based Redaction (`HYPERPROBE_REDACT_KEYS` / `redactKeys`)**:
  Configurable allowlists and denylists targeting object properties and variable names. Matching keys (e.g., `password`, `token`, `secret`, `ssn`, `creditCard`, `email`, `userId`) have their values replaced with `[REDACTED Key]` immediately at capture time.
* **Value-Based Regex Redaction (`HYPERPROBE_REDACT_VALUES` / `redactValues`)**:
  Configurable regular expression patterns applied against string values to detect and mask formatted PII (e.g., phone numbers, credit card sequences, government IDs) with `[REDACTED Value]`.
* **Bounded Depth & Memory Safeguards**:
  Snapshots enforce hard limits on object graph traversal (`MAX_DEPTH=5`) and overall payload size (`MAX_SNAPSHOT_SIZE=2MB`). This prevents accidental serialization of unbounded memory blocks or entire databases.
* **Targeted, Non-Persistent Probes**:
  Probes are temporary, targeted inspection points that automatically deactivate upon reaching hit thresholds or cooldown limits. They do not operate as continuous log drains.

### Cryptographic Safeguards

* **Data in Transit**: All communications between SDK agents, Logger brokers, backend APIs, and developer interfaces (VS Code / Dashboard) use TLS 1.2 or higher. Plaintext communication is disallowed in production environments.
* **Data at Rest**: Snapshot data, probe metadata, and database volumes are encrypted using standard AES-256 or cloud provider managed encryption keys.

### System Availability & Resilience (Article 32(1)(b))

Under GDPR, technical security encompasses ensuring the ongoing resilience and availability of processing systems:

* **Non-Blocking Execution**: HyperProbe agents execute asynchronously and never use halting debugger traps. They do not block application worker threads or introduce latency into production request paths.
* **Fail-Safe Conditional Probing**: Probe conditions evaluate in-process with strict exception boundaries. If a condition evaluation encounters an error, the agent fails closed safely without interrupting host application execution or crashing the process.

### AI & Machine Learning Data Safeguards (Zero-Training Policy)

* **No AI Model Training**: HyperProbe **does not** train artificial intelligence, large language models (LLMs), or machine learning models on customer source code, variable data, or snapshot telemetry.
* **Local MCP Control**: If developers utilize HyperProbe's Model Context Protocol (MCP) server for AI-assisted debugging, the protocol runs locally on the developer's workstation via `stdio`. Diagnostic context is delivered directly to the developer's chosen IDE client under their own governance.

### Access Control & Multi-Tenancy

* **Role-Based Access Control (RBAC)**: Fine-grained permissions segregate administrative access, probe creation, and snapshot viewing across organizations, teams, and environments.
* **Least Privilege**: SDK instrumentation operates within standard application process boundaries without requiring superuser, root, or elevated container capabilities.
* **Audit Trails**: Actions regarding probe creation, modification, snapshot access, and user configuration are logged for accountability and security reviews.

---

## 5. Shared Responsibility Model

Data protection in enterprise observability is a collaborative model:

| Area | Customer Responsibility | HyperProbe Responsibility |
| :--- | :--- | :--- |
| **Probe Placement** | Determining appropriate code locations and environments (dev, staging, prod) for investigation. | Providing role-based controls and confirmation checks before probes activate. |
| **Data Minimization** | Identifying sensitive application-specific variables and configuring `HYPERPROBE_REDACT_KEYS` / `HYPERPROBE_REDACT_VALUES`. | Enforcing key masking, value regex masking, and payload size bounds (`MAX_DEPTH`, `MAX_SNAPSHOT_SIZE`) at capture time. |
| **Access Governance** | Managing team membership, assigning least-privilege roles, and offboarding team members. | Enforcing strong session authentication, API token validation, and RBAC across control planes. |
| **Storage & Residency** | Choosing between Self-Hosted (In-VPC) or Cloud deployment to align with internal data residency policies. | Ensuring infrastructure encryption (TLS/AES-256), multi-tenant logical isolation, and automated snapshot retention purging. |

---

## 6. Data Processing Addendum (DPA) & Cross-Border Transfers

HyperProbe offers a Data Processing Addendum (DPA) as part of its managed-cloud customer agreement. Customers may also choose to self-host HyperProbe in their own environment.

---

## 7. Data Subject Rights & Retention (Articles 15–22)

Under GDPR, data subjects have rights regarding access, rectification, portability, and erasure ("Right to be Forgotten"):

* **Retention Windows**: Captured snapshot data is subject to automated retention limits. Snapshots are stored for a defined operational window (default: 30 days) and purged systematically from primary databases.
* **Immediate Deletion**: Customers can delete individual probes and associated snapshot payloads at any time through the dashboard or API.
* **Account Deletion**: Upon account termination or controller request, customer account details, user profiles, and associated telemetry data are permanently expunged in accordance with our DPA terms.

---

## 8. Security Incident & Breach Notification (Articles 33 & 34)

HyperProbe maintains an incident response protocol to address potential security events:

* **Notification Timeline**: If HyperProbe confirms a personal data breach impacting customer data in our cloud infrastructure, we will notify affected customers without undue delay (within **72 hours** of becoming aware of the breach).
* **Assistance**: HyperProbe will provide relevant information regarding the nature of the incident, categories of data involved, likely consequences, and remediation measures taken.

---

## 9. Summary Checklist for Enterprise Audits

| Requirement | Implementation in HyperProbe |
| :--- | :--- |
| **Formal DPA with SCCs** | Available upon request for all cloud customers |
| **Privacy by Design** | Native field masking (`redactKeys`), regex masking (`redactValues`), bounded depth (`MAX_DEPTH`) |
| **Resilience & Availability** | Asynchronous, non-blocking probes with fail-closed exception isolation |
| **Zero Model Training** | Customer source code and telemetry are strictly never used to train AI models |
| **Encryption in Transit** | TLS 1.2+ across gRPC, tRPC, HTTPS, and internal message brokers |
| **Encryption at Rest** | AES-256 for persistent PostgreSQL and database volume storage |
| **Data Residency Control** | Self-hosted / In-VPC deployment options ensure data never leaves the client network |
| **Retention & Erasure** | Automated snapshot time-to-live (TTL) and on-demand deletion APIs |
| **Breach Notification** | Documented commitment to notify within 72 hours of verified security incidents |

---

## 10. Contact & Inquiries

For questions regarding data protection, to request a signed copy of our Data Processing Addendum (DPA), or to report security and compliance concerns:

- **Privacy & Security**: `connect@hyperprobe.co`
