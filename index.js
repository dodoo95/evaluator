const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: 'OPENAIKEY' });

const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = process.env.PORT || 3000;

const path = require('path');

const fs = require("fs").promises;

const {google} = require('googleapis');

const customsearch = google.customsearch('v1');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

const headHTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="/style.css"><script src="https://code.highcharts.com/highcharts.js"></script><script src="https://code.highcharts.com/modules/exporting.js"></script><script src="https://code.highcharts.com/modules/export-data.js"></script><title>Evaluator</title></head>'

const getResponseChatGPT = async(query,model) => {
   const response = await openai.chat.completions.create({
      model: model,
      messages: [{'role': 'user', 'content': query}]
   }).catch((err)=>console.log(err.response));
   return response.choices[0].message.content.replace(/\r?\n/g,'<br>').replace(/\"/g,'').replace(/;/g,',');
}

const getResponseGoogle = async(query) => {
   const response = await customsearch.cse.list({
      cx: 'GOOGLECUSTOMSEARCH',
      q: query,
      auth: 'GOOGLEAPIKEY',
      gl: 'hr'
   });
   const results = response.data.items;   
   let list = '';
   if (!results) {
	  list = 'no answer';
   } else {
      results.forEach((result) => {
         list = list + '<a href=' + result.link + ' target=_blank>' + result.title + '</a><br>' + result.snippet + '<br><br>';
      });
   }
   return list.replace(/\r?\n/g,'<br>').replace(/\"/g,'').replace(/;/g,',');
}

app.get('/', async (req, res) => {
   const stats = await getStats('results.csv');
   res.send(`
      ${headHTML}
         <body>
            <div class="heading">
               Comparing ChatGPT and Google Search
            </div>
            <form method="POST" action="/compare">
               <p class="query">
                  <label for="query">Give your query:</label>
                  <br>
                  <textarea id="query" name="query"></textarea>
               </p>
               <p>
                  <input type="submit" class="submit" value="Get answers!">
               </p>
            </form>
            ${stats}
            <form method="POST" action="/ABtest">
               <p>
                  <input type="submit" class="submit" value="Run A/B testing"><select name="test" id="test"><option value="1">Google and ChatGPT 3.5</option><option value="2">Google and ChatGPT 4</option><option value="3">ChatGPT 3.5 and ChatGPT 4</option></select>
               </p>
            </form>
         </body>
      </html>
   `);
});

app.post('/compare', async (req, res) => {
   const query = req.body.query.replace(/\r?\n/g,'<br>').replace(/\"/g,'').replace(/;/g,',');
   const answer1 = await getResponseChatGPT(query,'gpt-3.5-turbo');
   const answer2 = await getResponseChatGPT(query,'gpt-4');
   const answer3 = await getResponseGoogle(query);
   const formattedAnswers = formatAnswer(answer1,answer2,answer3,query);
   res.send(formattedAnswers);
});

const formatAnswer = (response1,response2,response3,query) => {
   const heading = headHTML + '<body><div class="heading">Answer to query: <em>' + query + '</em></div>'
   const footer = '</body></html>'
   const score_list = '<option>10</option><option>9</option><option>8</option><option>7</option><option>6</option><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option>'

   let answers = "";

   answers = answers + '<div class="data"><div class="source">ChatGPT (model gpt-3.5-turbo)</div>'
   if(!response1){
     answers = answers + '<div class="answer">no asnwer returned</div><input type="hidden" id="record_answer1" name="record_answer1" value="">'
   } else {
     answers = answers + '<div class="answer">' + response1 + '</div><input type="hidden" id="record_answer1" name="record_answer1" value="' + response1 + '">'
   }
   answers = answers + '<div class="score"><label for="score1">Score answer (1-10):</label><select name="score1" id="score1">' + score_list + '</select></div></div>'

   answers = answers + '<div class="data"><div class="source">ChatGPT (model gpt-4)</div>'
   if(!response2){
     answers = answers + '<div class="answer">no asnwer returned</div><input type="hidden" id="record_answer2" name="record_answer2" value="">'
   } else {
     answers = answers + '<div class="answer">' + response2 + '</div><input type="hidden" id="record_answer2" name="record_answer2" value="' + response2 + '">'
   }
   answers = answers + '<div class="score"><label for="score2">Score answer (1-10):</label><select name="score2" id="score2">' + score_list + '</select></div></div>'

   answers = answers + '<div class="data"><div class="source">Google Search</div>'
   if(!response3){
     answers = answers + '<div class="answer">no asnwer returned</div><input type="hidden" id="record_answer3" name="record_answer3" value="">'
   } else {
     answers = answers + '<div class="answer">' + response3 + '</div><input type="hidden" id="record_answer3" name="record_answer3" value="' + response3 + '">'
   }
   answers = answers + '<div class="score"><label for="score3">Score answer (1-10):</label><select name="score3" id="score3">' + score_list + '</select></div></div>'

   return `${heading}
       <form method="POST" action="/record">
         ${answers}
         <input type="hidden" id="record_query" name="record_query" value="${query}">
         <input type="submit" class="submit" value="Store answer records!">
       </form>
       <p>
         <a href="../"><button>Or skip and give another query...</button></a>
       </p>
     ${footer}`;
}

const appendFile = async (path, data) => {
   try {
      await fs.appendFile(path, data);
   } catch (error) {
      console.error(error);
   }
};

const getStats = async (file) => {
   try {
      let query_number = 0;
      let score_sum1 = 0;
      let score_sum2 = 0;
      let score_sum3 = 0;
      let average1 = 0;
      let average2 = 0;
      let average3 = 0;
      let download_link = '';
      const data = await fs.readFile(path.join(__dirname, 'public', file), 'utf-8');
      if (data.trim() != '') {
        const list = data.trim().split('\n');
        for (let i = 0; i < list.length; i++) {
            console.log("sadržaj:"  + list[i] + "!");
            if (list[i] != null) {
               query_number++;
               let record = list[i].split(';');
               score_sum1 = score_sum1 + parseInt(record[5]);
               score_sum2 = score_sum2 + parseInt(record[6]);
               score_sum3 = score_sum3 + parseInt(record[7]);
             }
          }
          average1 = score_sum1/query_number;
          average2 = score_sum2/query_number;
          average3 = score_sum3/query_number;
          download_link = '<p><a href="/results.csv" download><button>Download CSV file with results</button></a></p>';
      }
      return `
         <table>
            <tr>
               <th>Number of queries</th>
               <td>${query_number}</td>
            </tr>
            <tr>
               <th>ChatGPT (model gpt-3.5-turbo) - Average score</th>
               <td>${Math.round(100*average1)/100}</td>
            </tr>
            <tr>
               <th>ChatGPT (model gpt-4) - Average score</th>
               <td>${Math.round(100*average2)/100}</td>
            </tr>
            <tr>
               <th>Google Search - Average score</th>
               <td>${Math.round(100*average3)/100}</td>
            </tr>
         </table>
         ${download_link}
         `;
   } catch (error) {
      console.error(error);
   }
};

app.post('/record', async (req, res) => {
   const query = req.body.record_query;
   const answer1 = req.body.record_answer1;
   const answer2 = req.body.record_answer2;
   const answer3 = req.body.record_answer3;
   const score1 = req.body.score1;
   const score2 = req.body.score2;
   const score3 = req.body.score3;

   let ts = Date.now();
   let date_ob = new Date(ts);
   let date = date_ob.getDate();
   let month = date_ob.getMonth() + 1;
   let year = date_ob.getFullYear();
   let hours = date_ob.getHours();
   let minutes = date_ob.getMinutes();
   let seconds = date_ob.getSeconds();

   appendFile(path.join(__dirname, 'public', 'results.csv'), date + '.' + month + '.' + year + ' ' + hours + ':' + minutes + ':' + seconds + ';' + query + ';' + answer1 + ';' + answer2 + ';' + answer3 + ';' + score1 + ';' + score2 + ';' + score3 + '\n');

   res.send(`
   ${headHTML}
      <body>
         <div class="heading">
            Stored to CSV file!
         </div>
         <p>
            <a href="../"><button>Give a new query...</button></a>
         </p>
      </body>
   </html>`);
});

//from: https://javascript.info/array-methods#shuffle-an-array
function shuffle(array) {
   for (let i = array.length - 1; i > 0; i--) {
     let j = Math.floor(Math.random() * (i + 1));
     let t = array[i];
     array[i] = array[j];
     array[j] = t;
  }
}

app.post('/ABtest', async (req, res) => {
   const test_type = req.body.test;
   let labelA = 'Google';
   let columnA = 7;
   let labelB = 'ChatGPT 3.5';
   let columnB = 5; 
   if (test_type == 2) {
      labelA = 'Google';
      columnA = 7;
      labelB = 'ChatGPT 4';
      columnB = 6; 
   } else if (test_type == 3) {
      labelA = 'ChatGPT 3.5';
      columnA = 5;
      labelB = 'ChatGPT 4';
      columnB = 6;
   }
   let table = [];
   let counterAnswersA = [0,0,0,0,0,0,0,0,0,0];
   let counterAnswersB = [0,0,0,0,0,0,0,0,0,0];
   let print_table_rows = '';
   let countA = 0;
   let countB = 0;
   let sumA = 0;
   let sumB = 0;
   let averageA = 0;
   let averageB = 0;
   let differenceAB = 0;
   let permutations_iterations = 5000;
   let permutations_countA = 0;
   let permutations_countB = 0;
   let permutations_sumA = 0;
   let permutations_sumB = 0;
   let permutations_averageA = 0;
   let permutations_averageB = 0;
   let permutations_differenceAB = 0;
   let countDifferences = [0,0,0,0,0,0,0,0,0,0,0];
   let count_big_differences = 0;
   let value_p = 0;
   let = conclusion = '';
   const data = await fs.readFile(path.join(__dirname, 'public', 'results.csv'), 'utf-8');
   const list = data.split('\n');
   for (let i = 0; i < list.length; i++) {
      if (list[i] != '') {
         let record = list[i].split(';');
         table.push([labelA,parseInt(record[columnA])]);
         table.push([labelB,parseInt(record[columnB])]);
         print_table_rows = print_table_rows + '<tr><td>' + labelA + '</td><td>' + record[columnA] + '</td></tr>';
         print_table_rows = print_table_rows + '<tr><td>' + labelB + '</td><td>' + record[columnB] + '</td></tr>';
	 sumA = sumA + parseInt(record[columnA]);
         sumB = sumB + parseInt(record[columnB]);
         countA++;
         countB++;
         counterAnswersA[parseInt(record[columnA])-1]++;
         counterAnswersB[parseInt(record[columnB])-1]++;
      }
   }
   averageA = sumA/countA;
   averageB = sumB/countB;
   differenceAB = averageA-averageB;
   for (i = 0; i < permutations_iterations; i++) {
	   let labels = [];
	   permutations_countA = 0;
	   permutations_countB = 0;
	   permutations_sumA = 0;
	   permutations_sumB = 0;
	   for (let j = 0; j < table.length; j++) {
		  labels.push(table[j][0]);
	   }
	   shuffle(labels);
	   for (let j = 0; j < table.length; j++) {
	      if (labels[j] == labelA) {
	         permutations_countA++;
	         permutations_sumA = permutations_sumA + table[j][1];
              } else {
                 permutations_countB++;
	         permutations_sumB = permutations_sumB + table[j][1];
              }
	   }
	   permutations_averageA = permutations_sumA/permutations_countA;
	   permutations_averageB = permutations_sumB/permutations_countB;
	   permutations_differenceAB = permutations_averageA - permutations_averageB;
	   if (permutations_differenceAB <= differenceAB) {
              count_big_differences++;
	   }
	   if (permutations_differenceAB < -1.8) {
		   countDifferences[0]++;
	   } else if (permutations_differenceAB >= -1.8 && permutations_differenceAB < -1.4) {
		   countDifferences[1]++;
	   } else if (permutations_differenceAB >= -1.4 && permutations_differenceAB < -1) {
		   countDifferences[2]++;
	   } else if (permutations_differenceAB >= -1 && permutations_differenceAB < -0.6) {
		   countDifferences[3]++;
	   } else if (permutations_differenceAB >= -0.6 && permutations_differenceAB < -0.2) {
		   countDifferences[4]++;
	   } else if (permutations_differenceAB >= -0.2 && permutations_differenceAB <= 0.2) {
		   countDifferences[5]++;
	   } else if (permutations_differenceAB > 0.2 && permutations_differenceAB <= 0.6) {
		   countDifferences[6]++;
	   } else if (permutations_differenceAB > 0.6 && permutations_differenceAB <= 1) {
		   countDifferences[7]++;		   
	   } else if (permutations_differenceAB > 1 && permutations_differenceAB <= 1.4) {
		   countDifferences[8]++;			   
	   } else if (permutations_differenceAB > 1.4 && permutations_differenceAB <= 1.8) {
		   countDifferences[9]++;	
	   } else if (permutations_differenceAB > 1.8) {
		   countDifferences[10]++;
	   }
   }
   value_p = count_big_differences/permutations_iterations;
   if (value_p <= 0.05) {
      conclusion = 'Result is statistically significant - test supports alternative hypothesis.';
   } else {
      conclusion = 'Result is not statistically significant - test supports null hypothesis.';
   }
   res.send(`
   ${headHTML}
      <body>
	     <div class="heading">A/B testing: ${labelA} and ${labelB}</div>
             <p class="highlight">
                Null hypothesis:<br><em>Distribution of scores of answers to queries from ${labelA} and ${labelB} is the same. Differences in the sample are due to chance.</em>
             </p>		 
             <p class="highlight">
                Alternative hypothesis:<br><em>Scores to answers from ${labelB} are on average higher than ${labelA}.</em>
             </p>
         <table>
            <tr>
               <th>Type</th>
               <th>Score</td>
            </tr>
            ${print_table_rows}
         </table>
	 <div id="container1" class="graph"></div>
         <p class="highlight">
            Average score for option A (${labelA}) = ${averageA}
         </p>
         <p class="highlight">
            Average score for option B (${labelB}) = ${averageB}
         </p>
         <p class="highlight">
            Difference of average scores (option A - option B) = ${differenceAB}
         </p>
	 <div id="container2" class="graph"></div>
         <p class="highlight">
            <em>p</em> = ${value_p}<br><em>${conclusion}</em>
         </p>
         <p>
            <a href="../"><button>Go back...</button></a>
         </p>
      </body>
	  <script>
	     chart1 = Highcharts.chart('container1', {
            chart: {
               type: 'column'
            },
			title: {
              text: 'Distribution of answers by scores',
            },
            xAxis: {
               categories: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
               crosshair: true,
			   title: {
                  text: 'score'
               }
            },
            yAxis: {
               min: 0,
               title: {
                  text: 'number of answers'
               }
            },
            plotOptions: {
               column: {
                  pointPadding: 0,
                  borderWidth: 0,
                  groupPadding: 0,
                  shadow: false
               }
            },
            series: [
               {
                  name: '${labelA}',
                  data: [${counterAnswersA.join(", ")}]
               },
               {
                  name: '${labelB}',
                  data: [${counterAnswersB.join(", ")}]
               }
            ]
         });
         chart1.update({
            exporting: {
               showTable: !chart1.options.exporting.showTable
            }
         });
		 chart2 = Highcharts.chart('container2', {
            chart: {
               type: 'column'
            },
			title: {
              text: 'Score differences in permutation testing',
            },
            xAxis: {
               categories: ['less than -1.8','-1.8 to -1.4', '-1.4 to -1', '-1 to -0.6', '-0.6 to -0.2', '-0.2 to 0.2', '0.2 to 0.6', '0.6 to 1', '1 to 1.4', '1.4 to 1.8', 'larger than 1.8'],
               crosshair: true,
			   title: {
                  text: 'score differences'
               }
            },
            yAxis: {
               min: 0,
               title: {
                  text: 'number of tests'
               }
            },
            plotOptions: {
               column: {
                  pointPadding: 0,
                  borderWidth: 0,
                  groupPadding: 0,
                  shadow: false
               }
            },
            series: [
               {
                  name: 'number of tests',
                  data: [${countDifferences.join(", ")}]
               }
            ]
         });
      </script>
   </html>`);
});

app.listen(port, () => {
   console.log(`Server is running on port ${port}`);
});