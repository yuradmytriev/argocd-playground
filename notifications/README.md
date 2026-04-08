# Argo CD Notifications → Email (yuramijs@gmail.com)

Sends Argo CD Application events to `yuramijs@gmail.com` via Gmail SMTP.

## Files

- `argocd-notifications-cm.yaml` — email service, templates, triggers, default subscription.
- `argocd-notifications-secret.yaml` — SMTP credentials template. **Do not commit the real password.**

## Prerequisites

1. Argo CD installed in the `argocd` namespace. The notifications controller ships with Argo CD ≥ 2.3 as `argocd-notifications-controller` — no separate install needed.
2. A Gmail **App Password** (Google Account → Security → 2-Step Verification → App passwords). Regular account passwords won't work.

## Apply

```sh
# 1. Create the secret with your App Password (do NOT commit it)
kubectl -n argocd create secret generic argocd-notifications-secret \
  --from-literal=email-username='yuramijs@gmail.com' \
  --from-literal=email-password='<gmail-app-password>' \
  --dry-run=client -o yaml | kubectl apply -f -

# 2. Apply the ConfigMap
kubectl apply -f argocd-notifications-cm.yaml

# 3. Restart the notifications controller so it picks up the new config
kubectl -n argocd rollout restart deploy/argocd-notifications-controller
```

## What triggers an email

| Trigger                 | When it fires                                           |
|-------------------------|---------------------------------------------------------|
| `on-deployed`           | App becomes Synced + Healthy (once per revision)        |
| `on-sync-failed`        | Sync operation ends in `Error` or `Failed`              |
| `on-health-degraded`    | Application health transitions to `Degraded`            |
| `on-sync-status-unknown`| Sync status becomes `Unknown`                           |

The `subscriptions:` block in the ConfigMap applies these to **every** Application in the cluster by default.

## Per-Application overrides

Skip the global subscription and subscribe a specific app instead:

```yaml
metadata:
  annotations:
    notifications.argoproj.io/subscribe.on-sync-failed.email: yuramijs@gmail.com
```

## Testing

Force a failure to verify the pipeline end-to-end:

```sh
# Break one of the playground apps and watch for an email
kubectl -n argocd patch app 01-basic --type merge \
  -p '{"spec":{"source":{"path":"does-not-exist"}}}'
```

Check controller logs if nothing arrives:

```sh
kubectl -n argocd logs deploy/argocd-notifications-controller -f
```

Common issues:
- **`535 Authentication failed`** — using your Gmail password instead of an App Password.
- **No logs about your app** — trigger condition didn't match; check `kubectl -n argocd get cm argocd-notifications-cm -o yaml`.
- **Controller not reloading** — restart it after editing the ConfigMap.
