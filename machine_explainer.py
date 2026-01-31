import json
import datetime
import os
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

# Constants
MODEL_NAME = "google/flan-t5-large"
LOG_FILE = "interaction_logs.json"

class MachineExplainer:
    def __init__(self, model_name=MODEL_NAME):
        print(f"Loading model: {model_name}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        
        # Use GPU if available
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)
        print(f"Model loaded on {self.device}.")

    def _humanize_decision_trace(self, trace):
        observations = []
        
        # 1. Handle REASONING TRACE (Specific Rules Schema)
        if "reasoning_trace" in trace:
            for step in trace["reasoning_trace"]:
                feature = step.get("feature", "Unknown Feature").replace("_", " ").capitalize()
                val = step.get("feature_value", 0)
                threshold = step.get("threshold", "N/A")
                comparison = step.get("comparison", "vs")
                
                observations.append(f"{feature}: {val} (Threshold: {comparison} {threshold})")
                
            # Add observed vs expected if available
            if "observed_behavior" in trace and "expected_behavior" in trace:
                observations.append(f"Behavior: Observed {trace['observed_behavior']} instead of {trace['expected_behavior']}")

        # 2. Handle Generic/Other Inputs (Fallback)
        else:
            for key, value in trace.items():
                if key in ["reasoning_trace", "rules_triggered", "final_confidence"]: 
                    continue # Skip redundant keys if mixed
                    
                formatted_key = key.replace("_", " ").capitalize()
                
                if isinstance(value, list):
                    if value:
                        items = ", ".join(str(v) for v in value)
                        observations.append(f"{formatted_key}: {items}")
                elif isinstance(value, (str, int, float, bool)):
                    observations.append(f"{formatted_key}: {value}")
                elif isinstance(value, dict):
                     observations.append(f"{formatted_key}: {str(value)}")

        return {
            "observations": observations
        }

    def generate_explanation(self, decision_trace):
        human_trace = self._humanize_decision_trace(decision_trace)
        
        data_text = "\n".join([f"- {obs}" for obs in human_trace['observations']])

        prompt = f"""
Data:
{data_text}

Task: Rewrite the provided recommendations below into a single, cohesive professional paragraph.
- You MUST include ALL specific actions, timeframes (e.g., 5-10 days), and safety notes.
- Do NOT summarize or shorten. 
- Connect the points fluently.

Recommendations:
"""
        inputs = self.tokenizer(prompt, return_tensors="pt", truncation=True).to(self.device)

        outputs = self.model.generate(
            **inputs,
            max_length=300,
            min_length=60,
            do_sample=True,
            temperature=0.3, 
            top_p=0.92,
            repetition_penalty=1.2,
            early_stopping=True
        )

        explanation = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
        return explanation

    def log_interaction(self, input_trace, output_explanation, user_feedback=None):
        log_entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "input_trace": input_trace,
            "output_explanation": output_explanation,
            "user_feedback": user_feedback
        }

        # Append to existing log file or create new one
        if os.path.exists(LOG_FILE):
            try:
                with open(LOG_FILE, 'r') as f:
                    logs = json.load(f)
                    if not isinstance(logs, list):
                        logs = []
            except (json.JSONDecodeError, ValueError):
                logs = []
        else:
            logs = []

        logs.append(log_entry)

        with open(LOG_FILE, 'w') as f:
            json.dump(logs, f, indent=4)
        
        print(f"Interaction logged to {LOG_FILE}")

INPUT_FILE = "final_recommendation.json"

def load_last_input(file_path):
    """Reads the JSON file and returns the last entry if it's a list."""
    if not os.path.exists(file_path):
        print(f"Error: Input file '{file_path}' not found.")
        return None
    
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        if isinstance(data, list):
            if not data:
                print("Error: Input list is empty.")
                return None
            print(f"Loaded input file with {len(data)} entries. Processing the last one.")
            return data[-1]
        elif isinstance(data, dict):
            print("Input file contains a single entry.")
            return data
        else:
            print("Error: Input file format not supported (must be list or dict).")
            return None
            
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return None

def main():
    # Load Input from File
    decision_trace = load_last_input(INPUT_FILE)
    
    if not decision_trace:
        print("Aborting: No valid input data found.")
        return

    # Initialize Explainer
    explainer = MachineExplainer()

    # Generate Explanation
    print("\nGenerating explanation...")
    explanation = explainer.generate_explanation(decision_trace)
    
    # Print Result
    print("-" * 50)
    print("Generated Explanation:")
    print(explanation)
    print("-" * 50)

    # Interactive Feedback
    print("\n" + "="*50)
    print("User Feedback Required")
    print("Options: [1] Accept  [2] Reject")
    
    while True:
        choice = input("Enter choice (1 for Accept, 2 for Reject): ").strip().lower()
        if choice in ['1', 'accept']:
            print("\nFeedback: Accepted")
            print("Action: Continuing along the pipeline...")
            feedback = "Accepted"
            break
        elif choice in ['2', 'reject']:
            print("\nFeedback: Rejected")
            print("Action: Optimizing thresholds... (Placeholder)")
            feedback = "Rejected"
            break
        else:
            print("Invalid choice. Please enter 1 or 2.")

    # Log Interaction
    explainer.log_interaction(decision_trace, explanation, user_feedback=feedback)

if __name__ == "__main__":
    main()