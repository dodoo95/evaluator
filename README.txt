before you start this is required:
- your open Open AI API paid account
- your generated key for Open AI API (replace string 'OPENAIKEY' in index.js)
- your cx key for customized Google Search engine from https://programmablesearchengine.google.com/controlpanel/create/congrats?cx= (replace string 'GOOGLECUSTOMSEARCH' in index.js)
- your generated key for Google API (replace string 'GOOGLEAPIKEY' in index.js)



installation steps:

1. install node.js
- https://nodejs.org/en/download
- choose Windows installer
- start installation with default options selected

2. install openai library
- open Documents folder
- open command line by entering cmd into address bar
- from command line run:
	npm install openai

3. install express library
- from Documents folder in command line run:
	npm install express
	npm install body-parser

4. install Google API library
- from Documents folder in command line run:
	npm install googleapis

5. create a new folder in the Documents folder
- make a new folder: evaluator
- copy index.js and package.json files to evaluator folder
- copy public folder (with style.css file and initially empty results.csv file) to evaluator folder

6. run app from Documents folder from command line by entering:
	node evaluator

7. from web browser visit following address:
	localhost:3000