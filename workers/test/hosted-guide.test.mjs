import assert from "node:assert/strict";
import {createRequire} from "node:module";
import test from "node:test";
import {revision} from "../src/evidence.mjs";

const require = createRequire(import.meta.url);
const {hostedResearchChat,hostedLabAnswer} = require("../../tmp/hosted-guide-test.cjs");
const {executeGuideTool} = require("../../tmp/guide-tool-test.cjs");

test("Groq uses the same audited planner and receives the exact read-only tool result", async (t) => {
  const before = process.env.GUIDE_GROQ_API_KEY;
  process.env.GUIDE_GROQ_API_KEY = "offline-test-key";
  t.after(() => {
    if (before === undefined) delete process.env.GUIDE_GROQ_API_KEY;
    else process.env.GUIDE_GROQ_API_KEY = before;
  });
  const payload = {
    question: "Can you check the predicted PMMA rate on the ISS for a 9.5 mm rod at 19% oxygen and 1.5 cm/s?",
    page: "/simulation",
    retrieval: {revision, hits: [{id:"pmma", score:.84}]},
  };
  let steps = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(options.headers.authorization, "Bearer offline-test-key");
    const input = JSON.parse(options.body);
    assert.equal(input.model, "openai/gpt-oss-120b");
    if (++steps === 1) {
      assert.equal(input.tool_choice, "required");
      assert.equal(input.parallel_tool_calls, false);
      return Response.json({choices:[{finish_reason:"tool_calls",message:{tool_calls:[{
        id:"prediction", type:"function", function:{name:"predict_pmma_rate",arguments:JSON.stringify({
          environment:"iss",diameter_mm:9.5,oxygen_pct:19,airflow_cms:1.5,
        })},
      }]}}]});
    }
    assert.deepEqual(input.response_format, {type:"json_object"});
    assert.equal(input.tools, undefined);
    const tool = input.messages.at(-1);
    assert.equal(tool.tool_call_id, "prediction");
    assert.equal(JSON.parse(tool.content).rate_mms, 0.04510522128989724);
    return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify({
      mode:"research",answer:"The supported ISS estimate is 0.045105 mm/s.",ids:["pmma"],actions:[],
    })}}]});
  });
  const signal = new AbortController().signal;
  const plan = await (await hostedResearchChat(payload, "", signal)).json();
  assert.equal(plan.status, "tool_request");
  const results = plan.calls.map(call => ({...executeGuideTool(call),call_id:call.id}));
  const reply = await (await hostedResearchChat({...payload,tool_results:results,tool_message:plan.tool_message},"",signal)).json();
  assert.equal(steps, 2);
  assert.equal(reply.generator, "openai/gpt-oss-120b");
  assert.equal(reply.encoder_revision, revision);
  assert.equal(reply.evidence[0].id, "pmma");
});

test("direct lab lookups keep records separate from estimates and efficacy claims", async () => {
  const flex = await hostedLabAnswer("Show FLEX methanol runs with CO₂.").json();
  assert.equal(flex.tools[0].name,"query_flex_cohort");
  assert.ok(flex.tools[0].rows.every(row=>row.co2_fraction>0));
  assert.equal(flex.evidence[0].id,"flex");
  assert.equal(hostedLabAnswer("Show whether He or CO2 is more effective for methanol in FLEX"),undefined);
  const pmma = await hostedLabAnswer("Look up published PMMA for a 0.64 cm rod at 21% O₂ and 5 cm/s in microgravity versus 1g.").json();
  assert.equal(pmma.tools[0].name,"lookup_pmma_records");
  assert.equal(pmma.tools[0].matched_rows,0);
  assert.ok(pmma.tools[0].support_checks.every(check=>check.rate_mms===null));
});
