import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = "https://dsyyqigoseqllkeqarsk.supabase.co";

const pythonCode = `import requests
import json

# Supabase Edge Function URL
EDGE_FUNCTION_URL = "${SUPABASE_URL}/functions/v1/camera-feed"

def report_phone_detected(room_number: str, student_name: str = None):
    """Report a phone detection incident"""
    response = requests.post(
        EDGE_FUNCTION_URL,
        json={
            "action": "phone_detected",
            "data": {
                "room_number": room_number,
                "student_name": student_name
            }
        },
        headers={"Content-Type": "application/json"}
    )
    return response.json()

def report_behavior_alert(room_number: str, behavior: str, student_name: str = None, severity: str = "medium"):
    """Report a behavior alert (Sleeping, Talking, Eating, Drinking)"""
    response = requests.post(
        EDGE_FUNCTION_URL,
        json={
            "action": "behavior_alert",
            "data": {
                "room_number": room_number,
                "behavior": behavior,
                "student_name": student_name,
                "severity": severity
            }
        },
        headers={"Content-Type": "application/json"}
    )
    return response.json()

def report_incident(incident_type: str, room_number: str, severity: str = "medium"):
    """Report a general incident"""
    response = requests.post(
        EDGE_FUNCTION_URL,
        json={
            "action": "report_incident",
            "data": {
                "incident_type": incident_type,
                "room_number": room_number,
                "severity": severity
            }
        },
        headers={"Content-Type": "application/json"}
    )
    return response.json()

def update_attendance(student_id: str, course_name: str, status: str = "present"):
    """Update student attendance"""
    response = requests.post(
        EDGE_FUNCTION_URL,
        json={
            "action": "update_attendance",
            "data": {
                "student_id": student_id,
                "course_name": course_name,
                "status": status
            }
        },
        headers={"Content-Type": "application/json"}
    )
    return response.json()

# ============= INTEGRATION WITH YOUR FACE RECOGNITION CODE =============
# Add these calls inside your detect_behaviors function:

# Example usage in your FastFaceRecognition class:
# 
# for behavior in behaviors:
#     if behavior == "Phone":
#         report_phone_detected(room_number="101", student_name=student_name)
#     elif behavior == "Sleeping":
#         report_behavior_alert("101", "Sleeping", student_name, "medium")
#     elif behavior == "Talking":
#         report_behavior_alert("101", "Talking", student_name, "low")
#     elif behavior == "Drinking":
#         report_behavior_alert("101", "Drinking", student_name, "low")
#     elif behavior == "Eating":
#         report_behavior_alert("101", "Eating", student_name, "low")
`;

const PythonIntegrationCode = () => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pythonCode);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Python code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Code className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">Python Integration Code</h4>
            <p className="text-sm text-muted-foreground">Click to {isExpanded ? 'hide' : 'view'} the code</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </>
          )}
        </Button>
      </div>
      
      {isExpanded && (
        <div className="border-t border-border">
          <pre className="p-4 overflow-x-auto text-sm bg-secondary/30 max-h-96 overflow-y-auto">
            <code className="text-foreground font-mono whitespace-pre">{pythonCode}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

export default PythonIntegrationCode;
