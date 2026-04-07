# argocd-playground

A progressive, hands-on study repo for learning [Argo CD](https://argo-cd.readthedocs.io/).
Each folder is a self-contained example that you register as an Argo CD `Application`.

## Structure

| Folder | Concept | What it teaches |
|---|---|---|
| `01-basic/` | A single Deployment | The smallest possible sync — one manifest, one app |
| `02-multi-resource/` | Deployment + Service + ConfigMap | Multiple resources in one app, health/status aggregation |
| `03-kustomize/` | base + dev/prod overlays | How Argo CD auto-detects Kustomize and renders overlays |
| `04-helm/` | Tiny Helm chart | How Argo CD renders Helm charts and passes values |
| `05-sync-waves/` | Ordered sync | Using `argocd.argoproj.io/sync-wave` annotations to sequence resources |
| `apps/` | Argo CD `Application` manifests | The GitOps objects that point back at the folders above |

## The "app of apps" pattern

`apps/root-app.yaml` is a single `Application` that points at the `apps/` folder.
When Argo CD syncs it, it discovers every other `Application` manifest in that folder
and creates them too. This means **you only ever apply one manifest to bootstrap everything**.

## Usage

Assuming you already have Argo CD running in the `argocd` namespace:

```bash
# Bootstrap: apply the root app, which pulls in everything else
kubectl apply -f apps/root-app.yaml

# Watch them appear
argocd app list
```

Then open the UI and explore each app's resource tree.

## Cleanup

```bash
kubectl delete -f apps/root-app.yaml
```

This cascades: removing the root deletes all child applications and their resources.
