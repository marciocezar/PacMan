.PHONY: help install dev build build-web preview sim rom

help:
	@printf '%s\n' \
		'make install     instala as dependências (npm install)' \
		'make dev         abre o jogo no navegador (npm run dev)' \
		'make build       confere o TypeScript e gera builds/web (npm run build)' \
		'make build-web   o mesmo pacote web (npm run build:web)' \
		'make preview     serve a pasta builds/web (npm run preview)' \
		'make sim         joga algumas centenas de quadros sem navegador' \
		'make rom         relê a ROM e atualiza docs/reverse-engineering'

install:
	npm install

dev:
	npm run dev

build:
	npm run build

build-web:
	npm run build:web

preview:
	npm run preview

sim:
	node tools/sim.mjs

rom:
	python3 tools/analyze_rom.py
