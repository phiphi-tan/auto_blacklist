
import asyncio
import aiohttp
from dotenv import load_dotenv
import os
from datetime import datetime
import argparse

load_dotenv()

# determined by number of pulses
async def lookupAlienVault(url):
    headers = {
        "X-OTX-API-KEY": os.getenv("ALIENVAULT_KEY"),
    }

    lookup_url = f"{os.getenv('ALIENVAULT_LOOKUP')}{url}/general"

    async with aiohttp.ClientSession() as session:
        async with session.get(lookup_url, headers=headers) as response:
            data = await response.json()

            if "error" in data:
                print(data)
                return (False, None)

            pulse_count = data.get("pulse_info", {}).get("count", 0)
            print("[LOOKUP OUTPUT]", data)

            return (pulse_count > 0, pulse_count)

async def lookupGoogleSafeBrowsing(url):
    body = {
        "client": {
            "clientId": "captcha-honeypot",
            "clientVersion": "1.0.0"
        },
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}]
        }
    }

    headers = {"Content-Type": "application/json"}
    api_url = f"{os.getenv('GOOGLE_SAFE_BROWSING_API')}?key={os.getenv('GOOGLE_SAFE_BROWSING_KEY')}"

    async with aiohttp.ClientSession() as session:
        async with session.post(api_url, headers=headers, json=body) as response:
            data = await response.json()
            print("[LOOKUP OUTPUT]", data)
            # empty response, url ok
            if not data or len(data.keys()) == 0:
                return (False, None)

            return (True, data["matches"][0]["threatType"])

async def lookupYandexSafeBrowsing(url):
    body = {
        "client": {
            "clientId": "captcha-honeypot",
            "clientVersion": "1.0.0"
        },
        "threatInfo": {
            "threatTypes": ["MALWARE", "SOCIAL_ENGINEERING"],
            "platformTypes": ["ANY_PLATFORM"],
            "threatEntryTypes": ["URL"],
            "threatEntries": [{"url": url}]
        }
    }

    headers = {"Content-Type": "application/json"}
    api_url = f"{os.getenv('YANDEX_SAFE_BROWSING_API')}?key={os.getenv('YANDEX_SAFE_BROWSING_KEY')}"

    async with aiohttp.ClientSession() as session:
        async with session.post(api_url, headers=headers, json=body) as response:
            data = await response.json()
            print("[LOOKUP OUTPUT]", data)
            key_count = len(data.keys())
            return (key_count > 0, key_count)

blacklist_dict = {
    "alienVault": lookupAlienVault,
    "googleSafeBrowsing": lookupGoogleSafeBrowsing,
    "yandexSafeBrowsing": lookupYandexSafeBrowsing,
}

async def lookup(url, blacklist):
    if blacklist not in blacklist_dict:
        print(f"[ERROR] {blacklist} not found")
        
    print(f"[LOOKUP] Looking up {url} in {blacklist}")
    # response expects (url_exists, status) as a tuple
    response = await blacklist_dict[blacklist](url)
    
    return {
        "url": url,
        "time": datetime.now(),
        "blacklist": blacklist,
        "url_exists": response[0],
        "status": response[1],
    }

async def poll_lookup(url, blacklist, interval_min=60, timeout_min=360):
    print(f"[POLL] Polling {url} in {blacklist}")
    start = asyncio.get_event_loop().time()
    interval_sec = interval_min * 60
    timeout_sec = timeout_min * 60

    try:
        while True:
            lookup_response = await lookup(url, blacklist)
            exists = lookup_response["url_exists"]

            if exists:
                print(f"{url} now exists in {blacklist}")
                break

            elapsed = asyncio.get_event_loop().time() - start
            if elapsed >= timeout_sec:
                print(f"[POLL TIMEOUT]: {url} on {blacklist}")
                break

            await asyncio.sleep(interval_sec)

    except Exception as err:
        print(f"Error polling {blacklist} for {url}: {err}")

async def poll_all_blacklists(url, blacklist_list, interval_min=60, timeout_min=360):
    tasks = [
        poll_lookup(url, bl, interval_min=interval_min, timeout_min=timeout_min)
        for bl in blacklist_list
    ]
    await asyncio.gather(*tasks)
        
if __name__ == "__main__":
    # Example URL and blacklist
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", type=str, required=True)
    parser.add_argument("--blacklist", type=str)

    args = parser.parse_args()
    url = args.url
    blacklist_list = [args.blacklist] if args.blacklist else ["alienVault", "googleSafeBrowsing", "yandexSafeBrowsing"]

    asyncio.run(poll_all_blacklists(url, blacklist_list, interval_min=0.1, timeout_min=0.5))