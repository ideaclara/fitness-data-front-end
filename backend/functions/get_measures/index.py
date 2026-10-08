import json
import os
import decimal
import boto3
from boto3.dynamodb.conditions import Key

dynamodb = boto3.resource("dynamodb", region_name="eu-west-2")
table = dynamodb.Table(os.environ.get("TABLE_NAME", "WithingsTelemetry"))
DEFAULT_USER_ID = os.environ.get("DEFAULT_USER_ID", "31179536")


class DecimalEncoder(json.JSONEncoder):
    """Encodes Boto3 Decimals to standard floats or ints."""

    def default(self, o):
        if isinstance(o, decimal.Decimal):
            return float(o) if o % 1 > 0 else int(o)
        return super(DecimalEncoder, self).default(o)


def build_response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body, cls=DecimalEncoder),
    }


def handler(event, context):
    query_params = event.get("queryStringParameters") or {}
    user_id = query_params.get("userId", DEFAULT_USER_ID)
    limit = min(int(query_params.get("limit", 50)), 100)
    cursor = query_params.get("cursor")

    pk_val = f"USER#{user_id}"
    sk_prefix = "WITHINGS#MEAS#"

    query_kwargs = {
        "KeyConditionExpression": Key("PK").eq(pk_val)
        & Key("SK").begins_with(sk_prefix),
        "ScanIndexForward": False,  # Reverse chronological (newest first)
        "Limit": limit,
    }

    if cursor:
        query_kwargs["ExclusiveStartKey"] = {"PK": pk_val, "SK": f"{sk_prefix}{cursor}"}

    try:
        response = table.query(**query_kwargs)
        items = response.get("Items", [])
        last_evaluated = response.get("LastEvaluatedKey")

        next_cursor = None
        if last_evaluated and "SK" in last_evaluated:
            next_cursor = last_evaluated["SK"].replace(sk_prefix, "")

        return build_response(
            200, {"data": items, "count": len(items), "next_cursor": next_cursor}
        )
    except Exception as e:
        print(f"Error querying DynamoDB: {str(e)}")
        return build_response(500, {"error": "Failed to fetch telemetry records"})
