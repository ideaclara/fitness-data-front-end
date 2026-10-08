import os
import json
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource("dynamodb", region_name="eu-west-2")
table = dynamodb.Table(os.environ.get("TABLE_NAME", "WithingsTelemetry"))
DEFAULT_USER_ID = os.environ.get("DEFAULT_USER_ID", "31179536")


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def handler(event, context):
    try:
        query_params = event.get("queryStringParameters") or {}
        user_id = query_params.get("userId", DEFAULT_USER_ID)
        limit = int(query_params.get("limit", 500))
        limit = min(max(limit, 1), 1000)

        cursor = query_params.get("cursor")
        start_date = query_params.get("startDate")
        end_date = query_params.get("endDate")
        filter_empty = query_params.get("filterEmpty", "true").lower() == "true"

        pk_value = f"USER#{user_id}"

        # 1. Construct Sort Key Condition
        if start_date and end_date:
            sk_start = f"WITHINGS#MEAS#{int(start_date):010d}"
            sk_end = f"WITHINGS#MEAS#{int(end_date):010d}"
            key_condition = Key("PK").eq(pk_value) & Key("SK").between(sk_start, sk_end)
        elif start_date:
            sk_start = f"WITHINGS#MEAS#{int(start_date):010d}"
            sk_max = "WITHINGS#MEAS#9999999999"
            key_condition = Key("PK").eq(pk_value) & Key("SK").between(sk_start, sk_max)
        else:
            key_condition = Key("PK").eq(pk_value) & Key("SK").begins_with(
                "WITHINGS#MEAS#"
            )

        # 2. Build Base Query Arguments
        query_kwargs = {
            "KeyConditionExpression": key_condition,
            "ScanIndexForward": False,  # Newest first
            "Limit": limit,
        }

        # 3. Optional DynamoDB Server-Side Filter Expression for valid weigh-ins
        if filter_empty:
            query_kwargs["FilterExpression"] = Attr("weight_kg").exists() & Attr(
                "weight_kg"
            ).gt(0)

        # 4. Handle Pagination Cursor
        if cursor:
            raw_cursor = cursor.replace("WITHINGS#MEAS#", "")
            query_kwargs["ExclusiveStartKey"] = {
                "PK": pk_value,
                "SK": f"WITHINGS#MEAS#{raw_cursor}",
            }

        items = []
        last_evaluated_key = None

        # 5. Fetch loop to ensure 'limit' valid records are gathered if filtering
        while len(items) < limit:
            response = table.query(**query_kwargs)
            batch = response.get("Items", [])
            items.extend(batch)
            last_evaluated_key = response.get("LastEvaluatedKey")

            if not last_evaluated_key or len(items) >= limit:
                break

            query_kwargs["ExclusiveStartKey"] = last_evaluated_key
            # Adjust remaining quota
            query_kwargs["Limit"] = limit - len(items)

        # Truncate to requested limit if loop over-fetched
        if len(items) > limit:
            items = items[:limit]

        next_cursor = None
        if last_evaluated_key and "SK" in last_evaluated_key:
            sk_val = str(last_evaluated_key["SK"])
            next_cursor = sk_val.replace("WITHINGS#MEAS#", "")

        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET,OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type,Authorization",
            },
            "body": json.dumps(
                {
                    "data": items,
                    "count": len(items),
                    "next_cursor": next_cursor,
                },
                cls=DecimalEncoder,
            ),
        }

    except Exception as e:
        print(f"Error querying telemetry: {str(e)}")
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
            "body": json.dumps({"error": str(e)}),
        }
