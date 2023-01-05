---
permalink: search.json
templateEngineOverride: njk
---
[
{%- for item in collections.docs -%}
{
"url" : "{{ item.url }}",
"title" : "{{ item.data.title }}",
"description" : "{{ item.templateContent | striptags | squash }}"
}{% if not loop.last %},{% else %}{%- endif -%}
{%- endfor -%}
]
