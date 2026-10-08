# Withings Telemetry Engine, Amplify Hosting & CodePipeline Spec

## 1. Cloud Architecture Overview
- **Deployment Region**: `eu-west-2` (London)
- **CI/CD Pipeline**: AWS CodePipeline (`WithingsTelemetry-CicdPipeline`) using CDK Pipelines.
- **Data Ingestion Engine**:
  - EventBridge heartbeat rule triggers `DispatcherFn` every 5 minutes.
  - Step Functions (`UniversalIngestionPipeline`) orchestrates OAuth2 token renewal via Secrets Manager (`prod/withings/credentials`) and triggers `RouterSyncFn`.
  - `RouterSyncFn` paginates Withings `/measure?action=getmeas`, applies SI conversion formulas (actual = value * 10^unit), and consolidates diagnostic groups into a unified `MEASUREMENT_SESSION`.
- **API Read Tier**:
  - Amazon API Gateway HTTP API (v2).
  - Lambda query handler reading from `WithingsTelemetry` DynamoDB table using KeyCondition queries.
- **Frontend Hosting Tier**:
  - AWS Amplify Hosting (provisioned via CDK) linked to repository `ideaclara/withings-data-on-aws`.
  - Global CloudFront distribution, automatic SSL termination, and continuous deployment on push to `main`.

---

## 2. Amazon DynamoDB Schema (`WithingsTelemetry`)
- **Billing Mode**: Pay-Per-Request (On-Demand)
- **Primary Partition Key (`PK`)**: `USER#<userid>`
- **Sort Key (`SK`)**: `WITHINGS#MEAS#<timestamp>`

### Consolidated Entity Attributes (`entity_type: MEASUREMENT_SESSION`)
| Field Name | DynamoDB Type | Description | Display Format |
| :--- | :--- | :--- | :--- |
| `PK` | String | User partition (`USER#31179536`) | Hidden |
| `SK` | String | Session sort key (`WITHINGS#MEAS#1790833196`) | Hidden |
| `timestamp` | Number | UTC Unix epoch | `YYYY-MM-DD HH:mm:ss` (BST/GMT) |
| `weight_kg` | Number | Total weight | `XX.XX kg` |
| `fat_ratio_pct` | Number | Body fat percentage | `XX.X %` |
| `fat_mass_weight_kg` | Number | Fat mass | `XX.XX kg` |
| `fat_free_mass_kg` | Number | Fat-free mass | `XX.XX kg` |
| `muscle_mass_kg` | Number | Skeletal muscle mass | `XX.XX kg` |
| `hydration_kg` | Number | Total body water | `XX.XX kg` |
| `bone_mass_kg` | Number | Bone mass | `XX.XX kg` |
| `heart_pulse_bpm` | Number | Resting heart rate | `XX bpm` |
| `pulse_wave_velocity_raw_ms` | Number | Unadjusted arterial transit velocity | `X.XX m/s` |
| `pulse_wave_velocity_normalized_ms` | Number | Heart-rate normalized PWV | `X.XX m/s` |
| `vascular_age_yrs` | Number | Biological vascular age (Withings Type 155) | `XX.X yrs` |
| `device_model` | String | Scale hardware model | String |

---

## 3. Data Retrieval API Contract

### Request
```http
GET /telemetry/measures?limit=50&cursor=1790833196 HTTP/1.1
Host: <api-id>.execute-api.eu-west-2.amazonaws.com

Response

{
  "items": [
    {
      "timestamp": 1790833196,
      "weight_kg": 80.048,
      "fat_ratio_pct": 20.887,
      "muscle_mass_kg": 60.15,
      "hydration_kg": 42.77,
      "bone_mass_kg": 3.16,
      "heart_pulse_bpm": 66,
      "pulse_wave_velocity_raw_ms": 7.294,
      "pulse_wave_velocity_normalized_ms": 7.446,
      "vascular_age_yrs": 59.2,
      "device_model": "Body Scan"
    }
  ],
  "count": 1,
  "next_cursor": null
}