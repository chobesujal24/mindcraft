Use this optional service when the server's Minecraft protocol is newer than the version supported by this Mindcraft install. The bot speaks a supported client protocol to ViaProxy; ViaProxy translates traffic to the server protocol.

This path is **opt-in**. With `via_proxy.enabled` left `false`, Mindcraft keeps its normal direct-connection behavior.

## Start ViaProxy

From the repository root, run:

```bash
docker compose --profile viaproxy up -d viaproxy
```

On first start, ViaProxy creates `services/viaproxy/viaproxy.yml`. Stop the container before editing its configuration:

```bash
docker compose --profile viaproxy stop viaproxy
```

Then set its listener and backend target. For a 26.3 server, the important values look like:

```yaml
bind-address: 0.0.0.0:25568
target-address: your.server.address:25565
target-version: 26.3
auth-method: NONE
```

Use the actual backend host and port in `target-address`. For an online-mode server, add a Microsoft account in ViaProxy and configure `auth-method` and `minecraft-account-index` according to ViaProxy's generated config. ViaProxy stores account data in its data directory; keep that directory private.

Restart the proxy after configuring it:

```bash
docker compose --profile viaproxy restart viaproxy
```

## Point Mindcraft at ViaProxy

In the dashboard's **Fleet → Cluster configuration** panel:

- Enable **Connect through ViaProxy**.
- Keep the target host, port, and version in sync with `target-address` and `target-version` in ViaProxy's config.
- Set **ViaProxy host/port** to the listener above. For a Mindcraft process running on the same Linux host, use `127.0.0.1` and `25568`.
- Set **Bot client version** to a version supported by this Mindcraft install. This checkout defaults to `26.1`.
- Save and restart ENI1 from the dashboard. This applies the connection change to the foreman-managed bot.

Bridge mode skips the direct backend-version probe because ViaProxy may advertise the backend's version. It connects Mineflayer using the configured client version and uses offline client authentication; ViaProxy handles authentication to online-mode servers.

If Mindcraft itself runs in Docker, use an address reachable from that container (for the included Compose network, the ViaProxy service name `viaproxy` can be used). Do not set the main `proxy` SOCKS/HTTP tunnel field to the ViaProxy address; the `via_proxy` option is separate.
