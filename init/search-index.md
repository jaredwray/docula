---
permalink: algolia.json
templateEngineOverride: njk
---
[
{%- for item in collections.docs -%}
{
"url" : "{{ item.url }}",
"title" : "{{ item.data.title }}",
"description" : "{{ item.templateContent | striptags }}",
"objectID": "{{ item.url }}"
}{% if not loop.last %},{% else %}{%- endif -%}
{%- endfor -%}
]
