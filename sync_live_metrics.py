"""
Autonomous 24/7 Live YouTube Metrics Sync Engine for Raj Tube Pro.
Queries YouTube Data API v3 directly to fetch real-time view counts,
subscriber counts, likes, and comments for all 10 channels and all videos.
"""

import os
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any, List

def get_credentials():
    yt_secret_env = os.environ.get("YOUTUBE_CLIENT_SECRET_JSON")
    yt_token_env = os.environ.get("YOUTUBE_REFRESH_TOKEN")

    # If env vars not set, check local workspace paths
    local_secret = r"E:\YT Auto GITHUB\client_secret.json"
    local_token = r"E:\YT Auto GITHUB\channel_1.token"

    if not yt_secret_env and os.path.exists(local_secret):
        with open(local_secret, "r", encoding="utf-8") as f:
            yt_secret_env = f.read()
    if not yt_token_env and os.path.exists(local_token):
        with open(local_token, "r", encoding="utf-8") as f:
            yt_token_env = f.read().strip()

    if not yt_secret_env or not yt_token_env:
        print("Error: Missing YOUTUBE_CLIENT_SECRET_JSON or YOUTUBE_REFRESH_TOKEN")
        return None

    try:
        data = json.loads(yt_secret_env) if isinstance(yt_secret_env, str) else yt_secret_env
        config = data.get("installed") or data.get("web") or data
        client_id = config["client_id"]
        client_secret = config["client_secret"]
    except Exception as e:
        print(f"Error parsing client secret: {e}")
        return None

    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=yt_token_env,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=client_id,
        client_secret=client_secret,
        scopes=["https://www.googleapis.com/auth/youtube.readonly"]
    )
    creds.refresh(Request())
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


CHANNEL_REPOS = {
    "channel_1": ("malhotramahi396-afk/yt-automation-the-hidden-lens", "data/channel_1.db"),
    "channel_2": ("malhotramahi396-afk/yt-automation-zyntrix07", "data/channel_2.db"),
    "channel_3": ("malhotramahi396-afk/yt-automation-vibrozen", "data/channel_3.db"),
    "channel_4": ("malhotramahi396-afk/yt-automation-vexorush", "data/channel_4.db"),
    "channel_5": ("malhotramahi396-afk/yt-automation-klyvo", "data/channel_5.db"),
    "channel_6": ("malhotramahi396-afk/yt-automation-corevantamedia", "data/channel_6.db"),
    "channel_7": ("malhotramahi396-afk/yt-automation-firenovavault", "data/channel_7.db"),
    "channel_8": ("malhotramahi396-afk/yt-automation-hyperfluxmotion", "data/channel_8.db"),
    "channel_9": ("malhotramahi396-afk/yt-automation-vortexedgestories", "data/channel_9.db"),
    "channel_10": ("malhotramahi396-afk/yt-automation-zenovadrift", "data/channel_10.db")
}


def sync_runner_nodes(channels: List[Dict[str, Any]]):
    """Fetches verified runner IP & timestamp directly from each channel's GitHub SQLite database."""
    import urllib.request, sqlite3, tempfile
    token = os.environ.get("GH_PAT") or os.environ.get("GITHUB_TOKEN")
    if not token:
        try:
            import subprocess
            res = subprocess.run(["gh", "auth", "token"], capture_output=True, text=True)
            if res.returncode == 0 and res.stdout.strip():
                token = res.stdout.strip()
        except Exception:
            pass

    if not token:
        print("Note: GitHub Token not found, keeping existing runner node telemetry.")
        return

    print(f"Syncing live Runner Public IPs across all {len(channels)} channels from GitHub...")
    for ch in channels:
        ch_id = ch.get("id")
        if ch_id not in CHANNEL_REPOS:
            continue
        repo, db_file = CHANNEL_REPOS[ch_id]
        try:
            req = urllib.request.Request(
                f"https://api.github.com/repos/{repo}/contents/{db_file}",
                headers={"Authorization": f"token {token}", "User-Agent": "RajTubePro-Sync"}
            )
            with urllib.request.urlopen(req, timeout=12) as r:
                meta = json.loads(r.read())
            download_url = meta.get("download_url")
            if not download_url:
                continue

            with urllib.request.urlopen(download_url, timeout=12) as r:
                content = r.read()

            with tempfile.NamedTemporaryFile(delete=False) as tf:
                tf.write(content)
                tf_path = tf.name

            conn = sqlite3.connect(tf_path)
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("SELECT started_at, finished_at, status, runner_ip, runner_city, runner_region, runner_country, runner_country_code, runner_org FROM runs WHERE runner_ip IS NOT NULL AND runner_ip != '' ORDER BY id DESC LIMIT 1")
            row = c.fetchone()
            if row:
                r_dict = dict(row)
                ip = r_dict["runner_ip"]
                c_code = r_dict.get("runner_country_code") or "US"
                run_time = r_dict.get("finished_at") or r_dict.get("started_at")

                ch["runner_node"] = {
                    "ip": ip,
                    "city": r_dict.get("runner_city") or "Des Moines",
                    "region": r_dict.get("runner_region") or "Iowa",
                    "country": r_dict.get("runner_country") or "United States",
                    "country_code": c_code,
                    "flag": "🇺🇸" if c_code == "US" else "🌐",
                    "org": r_dict.get("runner_org") or "AS8075 Microsoft Corporation",
                    "datacenter": "Microsoft Azure Cloud Runner",
                    "verified_at": run_time,
                    "verify_url": f"https://ipinfo.io/{ip}"
                }
                ch["latest_run_time"] = run_time
                ch["latest_run_status"] = r_dict.get("status", "success")
                print(f"  [{ch['name']}] Synced runner IP: {ip} ({r_dict.get('runner_city')}) at {run_time}")
            conn.close()
            os.unlink(tf_path)
        except Exception as e:
            print(f"  Warning: Could not sync runner IP for {ch.get('name')}: {e}")


def sync_metrics(data_json_path: str):
    if not os.path.exists(data_json_path):
        print(f"Error: {data_json_path} not found")
        sys.exit(1)

    with open(data_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    channels = data.get("channels", [])

    # 1. Sync Runner Nodes & IP Telemetry from GitHub
    sync_runner_nodes(channels)

    service = get_credentials()
    if not service:
        print("Cannot initialize YouTube API service. Aborting.")
        sys.exit(1)

    print("YouTube API service initialized successfully.")

    channel_ids = [c["youtube_channel_id"] for c in channels if c.get("youtube_channel_id")]

    # 1. Fetch live channel statistics
    print(f"Fetching channel stats for {len(channel_ids)} channels...")
    try:
        ch_res = service.channels().list(
            part="statistics,snippet",
            id=",".join(channel_ids)
        ).execute()

        channel_stats_map = {}
        for item in ch_res.get("items", []):
            cid = item["id"]
            stat = item.get("statistics", {})
            channel_stats_map[cid] = {
                "subscribers": int(stat.get("subscriberCount", 0)),
                "total_views": int(stat.get("viewCount", 0)),
                "channel_total_videos": int(stat.get("videoCount", 0))
            }

        for ch in channels:
            cid = ch.get("youtube_channel_id")
            if cid in channel_stats_map:
                ch["subscribers"] = channel_stats_map[cid]["subscribers"]
                ch["total_views"] = channel_stats_map[cid]["total_views"]
                ch["channel_total_videos"] = channel_stats_map[cid]["channel_total_videos"]
    except Exception as e:
        print(f"Warning: Channel stats fetch failed: {e}")

    # 2. Collect all video IDs across all channels
    all_vids = []
    for ch in channels:
        for v in ch.get("uploaded_videos", []):
            vid = v.get("youtube_id")
            if vid:
                all_vids.append(vid)

    print(f"Fetching real-time metrics for {len(all_vids)} videos...")

    # 3. Batch query videos in chunks of 50
    video_metrics_map = {}
    for i in range(0, len(all_vids), 50):
        chunk = all_vids[i:i+50]
        try:
            v_res = service.videos().list(
                part="statistics,snippet",
                id=",".join(chunk)
            ).execute()

            for item in v_res.get("items", []):
                vid = item["id"]
                stat = item.get("statistics", {})
                video_metrics_map[vid] = {
                    "views": int(stat.get("viewCount", 0)),
                    "likes": int(stat.get("likeCount", 0)),
                    "comments": int(stat.get("commentCount", 0))
                }
        except Exception as e:
            print(f"Warning: Video metrics chunk {i} failed: {e}")

    print(f"Successfully retrieved live metrics for {len(video_metrics_map)} videos.")

    # 4. Update videos in each channel
    total_network_views = 0
    total_network_subs = 0
    total_network_likes = 0
    total_network_vids = 0

    for ch in channels:
        ch_likes = 0
        vids = ch.get("uploaded_videos", [])
        for v in vids:
            vid = v.get("youtube_id")
            if vid and vid in video_metrics_map:
                m = video_metrics_map[vid]
                v["views"] = m["views"]
                v["likes"] = m["likes"]
                v["comments"] = m["comments"]
                ch_likes += m["likes"]

        ch["total_likes"] = ch_likes
        if len(vids) > 0:
            ch_vids_views = sum(v.get("views", 0) for v in vids)
            ch["avg_views_per_video"] = round(ch_vids_views / len(vids))

        total_network_subs += ch.get("subscribers", 0)
        total_network_views += ch.get("total_views", 0)
        total_network_likes += ch_likes
        total_network_vids += len(vids)

    # 5. Update summary
    if "summary" in data:
        data["summary"]["total_subscribers"] = total_network_subs
        data["summary"]["total_views"] = total_network_views
        data["summary"]["total_likes"] = total_network_likes
        data["summary"]["total_uploaded"] = total_network_vids
        if len(channels) > 0:
            data["summary"]["avg_views_per_channel"] = round(total_network_views / len(channels))

    # 6. Update timestamp
    now_utc = datetime.now(timezone.utc).isoformat()
    data["timestamp"] = now_utc

    # Write back
    with open(data_json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"data.json successfully updated with live real-time metrics at {now_utc}!")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "data.json")
    sync_metrics(target)
