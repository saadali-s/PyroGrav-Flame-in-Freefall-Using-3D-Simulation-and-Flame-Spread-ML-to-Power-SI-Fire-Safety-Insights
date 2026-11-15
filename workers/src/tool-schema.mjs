const numericConditions = {
  diameter_mm: {type:"number", description:"Rod diameter in mm. Convert cm to mm by multiplying by 10."},
  oxygen_pct: {type:"number", description:"Oxygen volume percentage, e.g. 18, not 0.18."},
  airflow_cms: {type:"number", description:"Imposed opposed airflow in cm/s."},
};
const tool = (name, description, properties) => ({type:"function",function:{name,description,
  parameters:{type:"object",properties,required:Object.keys(properties),additionalProperties:false}}});
export const tools = [
  tool("lookup_pmma_records", "Look up published black-PMMA measurements, including excluded review rows and unit/duplicate flags. Also returns separately labeled frozen-model support checks and estimates/abstentions for the requested condition, so do not duplicate this with prediction calls. Both returns Earth and ISS; nearby rows are explicitly NOT exact matches. Never average conflicting records or confuse measurements with model estimates.", {
    environment:{type:"string",enum:["earth","iss","both"]},...numericConditions,
  }),
  tool("predict_pmma_rate", "Evaluate an experimental frozen PMMA rate estimate with the same joint support gate as the lab. Not a measured value. Requires all four inputs.", {
    environment:{type:"string",enum:["earth","iss"]},...numericConditions,
  }),
  tool("query_flex_cohort", "Read eligible FLEX runs and saved predictions. Not an extinction/causal suppression model.", {
    fuel:{type:"string",enum:["Methanol","Heptane"]},diluent:{type:"string",enum:["CO2","He"]},
  }),
];
export const toolNames = new Set(tools.map(t=>t.function.name));
