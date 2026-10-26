# Demo narration — 26 October 2026

Offline synthetic narration using Samantha. Eight 30-second chapters; real-wallet segments use recorded evidence stills from the UI-managed run.

## 0:00 — The problem

A credential can be issued correctly and still fail when another wallet presents it. The mismatch may involve the format, a proof, the request profile, or verifier policy. Our interoperability playground helps MOSIP integrators and quality teams locate the observed boundary, compare combinations, and keep a reproducible, sanitized record of what actually happened.

## 0:30 — A fresh mock control

We begin with a fresh controlled run using separate mock issuer and verifier services and the reference wallet. The timeline follows issuance, storage, presentation, and verification. A valid outcome means this exact combination accepted the credential. It is mock interoperability evidence, clearly labelled, rather than a claim about an official Inji wallet.

## 1:00 — One changed variable

Next we corrupt the signature while keeping the controlled path the same. The verifier must reject it. The playground reports invalid, and the test passes because the expected rejection matched the actual result. This distinction matters: a passing negative test is evidence that a control worked. It is not an accepted attack or an interoperability success.

## 1:30 — The local real wallet

The pinned local deployment also completed a real Web wallet journey. Certify version zero point fourteen issued JSON L D through Inji Web zero point seventeen and Mimoto zero point twenty two. The exact newly issued card survived reload. That same wallet presented the card to local Verify zero point eighteen point two, which returned valid with both proof checks true.

## 2:00 — Inspect without claim values

This is the inspector from the fresh playground UI managed run. It shows allowlisted subject names and paths, withholding and truncation counts, and captured server hops. Claim values, tokens, cookies, and private keys stay out of the display. HTTP success only describes transport. The independent verifier result establishes the observed verdict, and missing browser traffic remains an explicit observation gap.

## 2:30 — Compare evidence honestly

The matrix and portable reports keep different kinds of evidence separate. Hosted Web observations, the local managed run, Android hybrid results, and synthetic controls have different deployments and limits. A manual observation does not become a fabricated database run. Component versions stay unreported when they were not established. This lets another team assess exactly what each result supports.

## 3:00 — Findings and upstream work

The findings register records reproducible setup and protocol differences with their versions and evidence. We filed the local initialization packaging issue and added compatibility and D I D evidence to existing upstream issues. The two sensitive local verification findings were submitted through the private reporting channel on October twenty sixth. Maintainer triage is pending. We do not claim confirmed defects in newer releases.

## 3:30 — What the prototype proves

The result is a working playground, a repeatable mock demonstration, a recorded same wallet local flow, and evidence that reviewers can inspect. Automated browser and accessibility checks passed. Synthetic authorization, D I D adaptation, and public network contexts are still declared limits. Physical device and human screen reader review remain separate checks. This video uses offline synthetic narration and recorded synthetic test data.
