{{/*
Common name/label helpers for the 01-basic-helm chart.
*/}}

{{- define "hello-basic-helm.name" -}}
{{- default .Chart.Name .Values.nameOverride -}}
{{- end -}}

{{- define "hello-basic-helm.labels" -}}
app: {{ include "hello-basic-helm.name" . }}
example: {{ .Values.exampleLabel | quote }}
{{- end -}}

{{- define "hello-basic-helm.selectorLabels" -}}
app: {{ include "hello-basic-helm.name" . }}
{{- end -}}
