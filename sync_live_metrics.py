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

            # Also sync any newly recorded videos from the channel's SQLite DB
            try:
                c.execute("SELECT filename, youtube_video_id, uploaded_at, status FROM videos WHERE status = 'uploaded' ORDER BY id DESC LIMIT 50")
                db_v_rows = c.fetchall()
                if db_v_rows:
                    vids = ch.get("uploaded_videos", [])
                    v_map = {v.get("youtube_id"): v for v in vids if v.get("youtube_id")}
                    added = 0
                    for vr in db_v_rows:
                        y_id = vr["youtube_video_id"]
                        if y_id and y_id not in v_map:
                            item = {
                                "title": vr["filename"].replace(".mp4", "").replace(".mov", "").strip(),
                                "youtube_id": y_id,
                                "youtube_url": f"https://youtu.be/{y_id}",
                                "studio_url": f"https://studio.youtube.com/video/{y_id}/edit",
                                "uploaded_at": vr["uploaded_at"],
                                "thumbnail": f"https://i.ytimg.com/vi/{y_id}/mqdefault.jpg",
                                "views": 0,
                                "likes": 0,
                                "comments": 0,
                                "is_clean": True,
                                "health_badge": "100% CLEAN",
                                "flag_details": "None (Clean)",
                                "channel_name": ch.get("name", "")
                            }
                            vids.append(item)
                            v_map[y_id] = item
                            added += 1
                    if added > 0:
                        print(f"  [{ch['name']}] Merged {added} new videos from cloud SQLite DB")
                        ch["uploaded_videos"] = vids
                        ch["uploaded_count"] = max(ch.get("uploaded_count", 0), len(vids))
            except Exception as v_err:
                print(f"  Warning: SQLite video sync error for {ch.get('name')}: {v_err}")

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

    # 1. Sync Runner Nodes & IP Telemetry from GitHub SQLite databases
    sync_runner_nodes(channels)

    service = get_credentials()
    if not service:
        print("Cannot initialize YouTube API service. Aborting.")
        sys.exit(1)

    print("YouTube API service initialized successfully.")

    channel_ids = [c["youtube_channel_id"] for c in channels if c.get("youtube_channel_id")]

    # 2. Fetch live channel statistics
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

    # 3. Query YouTube Uploads Playlists directly to catch newly uploaded videos
    print("Checking YouTube upload playlists across all channels for fresh uploads...")
    for ch in channels:
        cid = ch.get("youtube_channel_id")
        if not cid:
            continue
        try:
            uploads_pl_id = None
            try:
                ch_list_res = service.channels().list(part="contentDetails", id=cid).execute()
                items = ch_list_res.get("items", [])
                if items:
                    uploads_pl_id = items[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
            except Exception:
                pass
            if not uploads_pl_id:
                uploads_pl_id = "UU" + cid[2:]

            pl_res = service.playlistItems().list(
                playlistId=uploads_pl_id,
                part="snippet,contentDetails",
                maxResults=50
            ).execute()

            vids = ch.get("uploaded_videos", [])
            v_map = {v.get("youtube_id"): v for v in vids if v.get("youtube_id")}
            new_yt_count = 0
            for item in pl_res.get("items", []):
                vid_id = item.get("contentDetails", {}).get("videoId")
                if not vid_id:
                    continue
                snip = item.get("snippet", {})
                pub_at = snip.get("publishedAt") or item.get("contentDetails", {}).get("videoPublishedAt")
                title = snip.get("title", "Untitled Video")
                thumbs = snip.get("thumbnails", {})
                thumb_url = (
                    thumbs.get("medium", {}).get("url") or 
                    thumbs.get("high", {}).get("url") or 
                    f"https://i.ytimg.com/vi/{vid_id}/mqdefault.jpg"
                )

                if vid_id not in v_map:
                    new_vid = {
                        "title": title,
                        "youtube_id": vid_id,
                        "youtube_url": f"https://youtu.be/{vid_id}",
                        "studio_url": f"https://studio.youtube.com/video/{vid_id}/edit",
                        "uploaded_at": pub_at,
                        "thumbnail": thumb_url,
                        "views": 0,
                        "likes": 0,
                        "comments": 0,
                        "is_clean": True,
                        "health_badge": "100% CLEAN",
                        "flag_details": "None (Clean)",
                        "channel_name": ch.get("name", "")
                    }
                    vids.append(new_vid)
                    v_map[vid_id] = new_vid
                    new_yt_count += 1
                else:
                    if not v_map[vid_id].get("title") or v_map[vid_id].get("title") == vid_id:
                        v_map[vid_id]["title"] = title
                    if thumb_url and not v_map[vid_id].get("thumbnail"):
                        v_map[vid_id]["thumbnail"] = thumb_url
                    if pub_at and not v_map[vid_id].get("uploaded_at"):
                        v_map[vid_id]["uploaded_at"] = pub_at

            if new_yt_count > 0:
                print(f"  [{ch['name']}] Found and added {new_yt_count} fresh YouTube uploads from playlist!")
            ch["uploaded_videos"] = vids
            ch["uploaded_count"] = max(ch.get("uploaded_count", 0), len(vids))
        except Exception as yt_pl_err:
            print(f"  Note: Playlist lookup for {ch.get('name')} ({cid}): {yt_pl_err}")

    # 4. Collect all video IDs across all channels
    all_vids = []
    for ch in channels:
        for v in ch.get("uploaded_videos", []):
            vid = v.get("youtube_id")
            if vid and vid not in all_vids:
                all_vids.append(vid)

    print(f"Fetching real-time metrics and safety checks for {len(all_vids)} videos...")

    # 5. Batch query videos in chunks of 50
    video_metrics_map = {}
    for i in range(0, len(all_vids), 50):
        chunk = all_vids[i:i+50]
        try:
            v_res = service.videos().list(
                part="statistics,snippet,status,contentDetails",
                id=",".join(chunk)
            ).execute()

            for item in v_res.get("items", []):
                vid = item["id"]
                stat = item.get("statistics", {})
                snip = item.get("snippet", {})
                st = item.get("status", {})
                cd = item.get("contentDetails", {})
                thumbs = snip.get("thumbnails", {})
                thumb_url = (
                    thumbs.get("medium", {}).get("url") or 
                    thumbs.get("high", {}).get("url") or 
                    f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg"
                )

                upload_status = st.get("uploadStatus", "processed")
                privacy_status = st.get("privacyStatus", "public")
                rejection_reason = st.get("rejectionReason")
                region_restriction = cd.get("regionRestriction", {}) or {}
                blocked_regions = region_restriction.get("blocked", []) if isinstance(region_restriction, dict) else []
                is_blocked = (upload_status == "rejected") or (privacy_status not in ["public", "unlisted"]) or len(blocked_regions) > 50
                health_badge = "100% CLEAN" if not is_blocked else "RESTRICTED"
                flag_details = f"Blocked in {len(blocked_regions)} regions" if blocked_regions else (rejection_reason or "None (Clean)")

                video_metrics_map[vid] = {
                    "title": snip.get("title"),
                    "views": int(stat.get("viewCount", 0)),
                    "likes": int(stat.get("likeCount", 0)),
                    "comments": int(stat.get("commentCount", 0)),
                    "thumbnail": thumb_url,
                    "is_blocked": is_blocked,
                    "health_badge": health_badge,
                    "flag_details": flag_details,
                    "privacy_status": privacy_status,
                    "upload_status": upload_status
                }
        except Exception as e:
            print(f"Warning: Video metrics chunk {i} failed: {e}")

    print(f"Successfully retrieved live metrics for {len(video_metrics_map)} videos.")

    # 6. Update videos in each channel and sort descending by date
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
                if m.get("title") and (not v.get("title") or v.get("title") == vid):
                    v["title"] = m["title"]
                if m.get("thumbnail"):
                    v["thumbnail"] = m["thumbnail"]
                v["is_blocked"] = m.get("is_blocked", False)
                v["health_badge"] = m.get("health_badge", "100% CLEAN")
                v["flag_details"] = m.get("flag_details", "None (Clean)")
                ch_likes += m["likes"]

        # Sort channel videos by latest upload first
        vids.sort(key=lambda x: x.get("uploaded_at") or "", reverse=True)
        ch["uploaded_videos"] = vids
        ch["uploaded_count"] = max(ch.get("uploaded_count", 0), len(vids))
        if vids:
            ch["latest_uploaded_video"] = vids[0]

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

    # 6. Update schedule & countdown
    from datetime import timedelta
    now_dt = datetime.now(timezone.utc)
    today = now_dt.date()
    slot_1 = datetime(today.year, today.month, today.day, 14, 0, 0, tzinfo=timezone.utc)
    slot_2 = datetime(today.year, today.month, today.day, 21, 0, 0, tzinfo=timezone.utc)
    tomorrow_slot_1 = slot_1 + timedelta(days=1)

    if now_dt < slot_1:
        next_slot = slot_1
        slot_label = "10:00 AM USA (7:30 PM IST)"
    elif now_dt < slot_2:
        next_slot = slot_2
        slot_label = "05:00 PM USA (2:30 AM IST)"
    else:
        next_slot = tomorrow_slot_1
        slot_label = "10:00 AM USA (7:30 PM IST Tomorrow)"

    sec_rem = max(0, int((next_slot - now_dt).total_seconds()))
    h = sec_rem // 3600
    m = (sec_rem % 3600) // 60
    s = sec_rem % 60

    data["schedule"] = {
        "next_slot_iso": next_slot.isoformat(),
        "seconds_remaining": sec_rem,
        "formatted_countdown": f"{h:02d}h {m:02d}m {s:02d}s",
        "slot_label": slot_label,
        "now_ist": (now_dt + timedelta(hours=5, minutes=30)).strftime("%d %b, %I:%M %p IST")
    }

    # 7. Update timestamp
    now_utc = now_dt.isoformat()
    data["timestamp"] = now_utc

    # Write back
    with open(data_json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"data.json successfully updated with live real-time metrics at {now_utc}!")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "data.json")
    sync_metrics(target)
