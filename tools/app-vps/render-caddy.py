#!/usr/bin/env python3
"""Render the two branch sites while preserving the verified media adapter."""
import argparse
import importlib.util
from pathlib import Path
import re


def render(media_helper, release, main_upstream="everfolk-main:8787"):
    spec = importlib.util.spec_from_file_location("everfolk_media_pin", media_helper)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    sites = []
    for hostname, branch, upstream in [("everfolk.life", "main", main_upstream), ("beta.everfolk.life", "dev", "everfolk-beta:8787")]:
        if not re.fullmatch(r"[a-z0-9.-]+:[0-9]{1,5}", upstream):
            raise ValueError("Invalid upstream")
        sites.append(hostname + " {\n\tencode gzip\n\trequest_header -oai-authenticated-user-*\n\theader X-Everfolk-Branch " + branch + "\n" + ("\theader X-Robots-Tag \"noindex, nofollow\"\n" if branch == "dev" else "") + helper.media_block(release, app=upstream) + """\thandle /releases/* {
\t\treverse_proxy everfolk-art-origin-1:8080
\t}
\thandle /build-info.json {
\t\treverse_proxy UPSTREAM {
\t\t\theader_down Cache-Control \"no-store\"
\t\t\theader_down -CDN-Cache-Control
\t\t\theader_down -Cloudflare-CDN-Cache-Control
\t\t}
\t}
\thandle /api/* {
\t\treverse_proxy UPSTREAM {
\t\t\theader_down Cache-Control \"no-store\"
\t\t}
\t}
\thandle {
\t\treverse_proxy UPSTREAM
\t}
}
""".replace("UPSTREAM", upstream))
    return "\n".join(sites) + "\nwww.everfolk.life, 139-180-190-154.sslip.io {\n\tredir https://everfolk.life{uri} permanent\n}\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--media-helper", type=Path, default=Path("/opt/everfolk-art/bin/pin-media-release.py"))
    parser.add_argument("--release", default="media-20261114-v1")
    parser.add_argument("--main-upstream", default="everfolk-main:8787")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    args.output.write_text(render(args.media_helper, args.release, args.main_upstream))
