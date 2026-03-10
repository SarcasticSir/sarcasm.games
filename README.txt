Hei

Main branch workflow
--------------------
Use these commands so work and deploy always target main:

  npm run switch:main
  npm run verify:main

What they do:
- switch:main
  - switches to local main if it exists
  - or creates main from origin/main if available
  - or creates local main (with warning) if no remote main is available
- verify:main
  - requires current branch = main
  - requires remote origin to exist
  - requires local main == origin/main
  - requires clean working tree
