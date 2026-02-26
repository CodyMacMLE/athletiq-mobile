ROOT := $(shell pwd)

.PHONY: dev dev-backend dev-web dev-mobile

# Start all three services in separate Terminal windows
dev:
	@osascript \
		-e 'tell application "Terminal"' \
		-e '  do script "cd $(ROOT)/Backend && npm run dev"' \
		-e '  do script "cd $(ROOT)/Frontend/Web && npm run dev"' \
		-e '  do script "cd $(ROOT)/Frontend/Mobile && npx expo start"' \
		-e 'end tell'
	@echo "Opening Backend (port 4000), Web (port 3000), and Mobile (Expo) in Terminal."

dev-backend:
	cd Backend && npm run dev

dev-web:
	cd Frontend/Web && npm run dev

dev-mobile:
	cd Frontend/Mobile && npx expo start
