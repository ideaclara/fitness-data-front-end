import os
import json
import boto3
from decimal import Decimal
from boto3.dynamodb.conditions import Key

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
        max_records = int(query_params.get("limit", 1000))
        max_records = min(max(max_records, 1), 2000)

        pk_value = f"USER#{user_id}"

        # Fetch newest first across all WITHINGS#MEAS# items
        query_kwargs = {
            "KeyConditionExpression": Key("PK").eq(pk_value)
            & Key("SK").begins_with("WITHINGS#MEAS#"),
            "ScanIndexForward": False,
        }

        all_items = []

        while len(all_items) < max_records:
            response = table.query(**query_kwargs)
            all_items.extend(response.get("Items", []))

            last_key = response.get("LastEvaluatedKey")
            if not last_key or len(all_items) >= max_records:
                break
            query_kwargs["ExclusiveStartKey"] = last_key

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
                    "data": all_items,
                    "count": len(all_items),
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
