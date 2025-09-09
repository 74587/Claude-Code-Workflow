---
name: ui-designer
description: UI designer perspective brainstorming for user experience and interface design analysis
usage: /workflow:brainstorm:ui-designer <topic>
argument-hint: "topic or challenge to analyze from UI/UX design perspective"
examples:
  - /workflow:brainstorm:ui-designer "user authentication redesign"
  - /workflow:brainstorm:ui-designer "mobile app navigation improvement"
  - /workflow:brainstorm:ui-designer "accessibility enhancement strategy"
allowed-tools: Task(conceptual-planning-agent), TodoWrite(*)
---

## 🎨 **Role Overview: UI Designer**

### Role Definition
Creative professional responsible for designing intuitive, accessible, and visually appealing user interfaces that create exceptional user experiences aligned with business goals and user needs.

### Core Responsibilities
- **User Experience Design**: Create intuitive and efficient user experiences
- **Interface Design**: Design beautiful and functional user interfaces
- **Interaction Design**: Design smooth user interaction flows and micro-interactions
- **Accessibility Design**: Ensure products are inclusive and accessible to all users

### Focus Areas
- **User Experience**: User journeys, usability, satisfaction metrics, conversion optimization
- **Visual Design**: Interface aesthetics, brand consistency, visual hierarchy
- **Interaction Design**: Workflow optimization, feedback mechanisms, responsiveness
- **Accessibility**: WCAG compliance, inclusive design, assistive technology support

### Success Metrics
- User satisfaction scores and usability metrics
- Task completion rates and conversion metrics
- Accessibility compliance scores
- Visual design consistency and brand alignment

## 🧠 **Analysis Framework**

@~/.claude/workflows/brainstorming-principles.md
@~/.claude/workflows/brainstorming-framework.md

### Key Analysis Questions

**1. User Needs and Behavior Analysis**
- What are the main pain points users experience during interactions?
- What gaps exist between user expectations and actual experience?
- What are the specific needs of different user segments?

**2. Interface and Interaction Design**
- How can we simplify operational workflows?
- Is the information architecture logical and intuitive?
- Are interaction feedback mechanisms timely and clear?

**3. Visual and Brand Strategy**
- Does the visual design support and strengthen brand identity?
- Are color schemes, typography, and layouts appropriate and effective?
- How can we ensure cross-platform consistency?

**4. Technical Implementation Considerations**
- What are the technical feasibility constraints for design concepts?
- What responsive design requirements must be addressed?
- How do performance considerations impact user experience?

## ⚙️ **Execution Protocol**

### Phase 1: Session Detection & Initialization
```bash
# Detect active workflow session
CHECK: .workflow/.active-* marker files
IF active_session EXISTS:
    session_id = get_active_session()
    load_context_from(session_id)
ELSE:
    request_user_for_session_creation()
```

### Phase 2: Directory Structure Creation
```bash
# Create UI designer analysis directory
mkdir -p .workflow/WFS-{topic-slug}/.brainstorming/ui-designer/
```

### Phase 3: Task Tracking Initialization
Initialize UI designer perspective analysis tracking:
```json
[
  {"content": "Initialize UI designer brainstorming session", "status": "completed", "activeForm": "Initializing session"},
  {"content": "Analyze current user experience and pain points", "status": "in_progress", "activeForm": "Analyzing user experience"},
  {"content": "Design user journey and interaction flows", "status": "pending", "activeForm": "Designing user flows"},
  {"content": "Create visual design concepts and mockups", "status": "pending", "activeForm": "Creating visual concepts"},
  {"content": "Evaluate accessibility and usability", "status": "pending", "activeForm": "Evaluating accessibility"},
  {"content": "Plan responsive design strategy", "status": "pending", "activeForm": "Planning responsive design"},
  {"content": "Generate comprehensive UI/UX documentation", "status": "pending", "activeForm": "Generating documentation"}
]
```

### Phase 4: Conceptual Planning Agent Coordination
```bash
Task(conceptual-planning-agent): "
Conduct UI designer perspective brainstorming for: {topic}

ROLE CONTEXT: UI Designer
- Focus Areas: User experience, interface design, visual design, accessibility
- Analysis Framework: User-centered design approach with emphasis on usability and accessibility
- Success Metrics: User satisfaction, task completion rates, accessibility compliance, visual appeal

USER CONTEXT: {captured_user_requirements_from_session}

ANALYSIS REQUIREMENTS:
1. User Experience Analysis
   - Identify current UX pain points and friction areas
   - Map user journeys and identify optimization opportunities
   - Analyze user behavior patterns and preferences
   - Evaluate task completion flows and success rates

2. Interface Design Assessment
   - Review current interface design and information architecture
   - Identify visual hierarchy and navigation issues  
   - Assess consistency across different screens and states
   - Evaluate mobile and desktop interface differences

3. Visual Design Strategy
   - Develop visual design concepts aligned with brand guidelines
   - Create color schemes, typography, and spacing systems
   - Design iconography and visual elements
   - Plan for dark mode and theme variations

4. Interaction Design Planning
   - Design micro-interactions and animation strategies
   - Plan feedback mechanisms and loading states
   - Create error handling and validation UX
   - Design responsive behavior and breakpoints

5. Accessibility and Inclusion
   - Evaluate WCAG 2.1 compliance requirements
   - Design for screen readers and assistive technologies
   - Plan for color blindness and visual impairments
   - Ensure keyboard navigation and focus management

6. Prototyping and Testing Strategy
   - Plan for wireframes, mockups, and interactive prototypes
   - Design user testing scenarios and success metrics
   - Create A/B testing strategies for key interactions
   - Plan for iterative design improvements

OUTPUT REQUIREMENTS: Save comprehensive analysis to:
.workflow/WFS-{topic-slug}/.brainstorming/ui-designer/
- analysis.md (main UI/UX analysis)
- design-system.md (visual design guidelines and components)
- user-flows.md (user journey maps and interaction flows)
- accessibility-plan.md (accessibility requirements and implementation)

Apply UI/UX design expertise to create user-centered, accessible, and visually appealing solutions."
```

## 📊 **Output Specification**

### Output Location
```
.workflow/WFS-{topic-slug}/.brainstorming/ui-designer/
├── analysis.md                 # Primary UI/UX analysis
├── design-system.md            # Visual design guidelines and components
├── user-flows.md               # User journey maps and interaction flows
└── accessibility-plan.md       # Accessibility requirements and implementation
```

### Document Templates

#### analysis.md Structure
```markdown
# UI Designer Analysis: {Topic}
*Generated: {timestamp}*

## Executive Summary
[Key UX findings and design recommendations overview]

## Current UX Assessment
### User Pain Points
### Interface Issues
### Accessibility Gaps
### Performance Impact on UX

## User Experience Strategy
### Target User Personas
### User Journey Mapping
### Key Interaction Points
### Success Metrics

## Visual Design Approach
### Brand Alignment
### Color and Typography Strategy
### Layout and Spacing System
### Iconography and Visual Elements

## Interface Design Plan
### Information Architecture
### Navigation Strategy
### Component Library
### Responsive Design Approach

## Accessibility Implementation
### WCAG Compliance Plan
### Assistive Technology Support
### Inclusive Design Features
### Testing Strategy

## Prototyping and Validation
### Wireframe Strategy
### Interactive Prototype Plan
### User Testing Approach
### Iteration Framework
```

## 🔄 **Session Integration**

### Status Synchronization
Upon completion, update `workflow-session.json`:
```json
{
  "phases": {
    "BRAINSTORM": {
      "ui_designer": {
        "status": "completed",
        "completed_at": "timestamp",
        "output_directory": ".workflow/WFS-{topic}/.brainstorming/ui-designer/",
        "key_insights": ["ux_improvement", "accessibility_requirement", "design_pattern"]
      }
    }
  }
}
```

### Cross-Role Collaboration
UI designer perspective provides:
- **User Interface Requirements** → System Architect
- **User Experience Metrics and Goals** → Product Manager
- **Data Visualization Requirements** → Data Architect
- **Secure Interaction Design Patterns** → Security Expert
- **Feature Interface Specifications** → Feature Planner

## ✅ **Quality Assurance**

### Required Design Elements
- [ ] Comprehensive user journey analysis with pain points identified
- [ ] Complete interface design solution with visual mockups
- [ ] Accessibility compliance plan meeting WCAG 2.1 standards
- [ ] Responsive design strategy for multiple devices and screen sizes
- [ ] Usability testing plan with clear success metrics

### Design Principles Validation
- [ ] **User-Centered**: All design decisions prioritize user needs and goals
- [ ] **Consistency**: Interface elements and interactions maintain visual and functional consistency
- [ ] **Accessibility**: Design meets WCAG guidelines and supports assistive technologies
- [ ] **Usability**: Operations are simple, intuitive, with minimal learning curve
- [ ] **Visual Appeal**: Design supports brand identity while creating positive user emotions

### UX Quality Metrics
- [ ] **Task Success**: High task completion rates with minimal errors
- [ ] **Efficiency**: Optimal task completion times with streamlined workflows
- [ ] **Satisfaction**: Positive user feedback and high satisfaction scores
- [ ] **Accessibility**: Full compliance with accessibility standards and inclusive design
- [ ] **Consistency**: Uniform experience across different devices and platforms

### Implementation Readiness
- [ ] **Design System**: Comprehensive component library and style guide
- [ ] **Prototyping**: Interactive prototypes demonstrating key user flows
- [ ] **Documentation**: Clear specifications for development implementation
- [ ] **Testing Plan**: Structured approach for usability and accessibility validation
- [ ] **Iteration Strategy**: Framework for continuous design improvement based on user feedback