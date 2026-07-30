export type LearningPathId = 'social-skills' | 'entrepreneurship' | 'fitness'
export type LearningDifficulty = 'foundation' | 'intermediate' | 'advanced'

export interface ConceptExercise {
  id: string
  type: 'concept'
  title: string
  body: string
  takeaway: string
}

export interface ChoiceExercise {
  id: string
  type: 'choice'
  prompt: string
  options: string[]
  correctIndex?: number
  explanation: string
}

export interface ScenarioExercise {
  id: string
  type: 'scenario'
  context: string
  prompt: string
  options: string[]
  correctIndex?: number
  explanation: string
}

export interface OrderExercise {
  id: string
  type: 'order'
  prompt: string
  items: string[]
  explanation: string
}

export interface ReflectionExercise {
  id: string
  type: 'reflection'
  prompt: string
  placeholder: string
}

export type LearningExercise =
  | ConceptExercise
  | ChoiceExercise
  | ScenarioExercise
  | OrderExercise
  | ReflectionExercise

export interface PathLesson {
  id: string
  title: string
  description: string
  icon: string
  difficulty: LearningDifficulty
  estimatedMinutes: number
  masteryPoints: number
  exercises: LearningExercise[]
}

export interface LearningUnit {
  id: string
  title: string
  description: string
  lessons: PathLesson[]
}

export interface LearningPath {
  id: LearningPathId
  title: string
  shortTitle: string
  description: string
  outcome: string
  icon: string
  accent: 'violet' | 'amber' | 'emerald'
  units: LearningUnit[]
}

export interface LearningCatalog {
  version: 1
  paths: LearningPath[]
}

export interface LessonCompletion {
  lessonId: string
  completedAt: string
  score: number
  mistakes: number
}

export interface LearningProgress {
  version: 1
  completions: Record<string, LessonCompletion>
  reflections: Record<string, string>
}

type LessonInput = Omit<PathLesson, 'difficulty' | 'estimatedMinutes' | 'masteryPoints'> &
  Partial<Pick<PathLesson, 'difficulty' | 'estimatedMinutes' | 'masteryPoints'>>

function makeLesson(input: LessonInput): PathLesson {
  return {
    difficulty: 'foundation',
    estimatedMinutes: 6,
    masteryPoints: 100,
    ...input,
  }
}

function concept(id: string, title: string, body: string, takeaway: string): ConceptExercise {
  return { id, type: 'concept', title, body, takeaway }
}

function choice(
  id: string,
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string
): ChoiceExercise {
  return { id, type: 'choice', prompt, options, correctIndex, explanation }
}

function scenario(
  id: string,
  context: string,
  prompt: string,
  options: string[],
  correctIndex: number,
  explanation: string
): ScenarioExercise {
  return { id, type: 'scenario', context, prompt, options, correctIndex, explanation }
}

function order(id: string, prompt: string, items: string[], explanation: string): OrderExercise {
  return { id, type: 'order', prompt, items, explanation }
}

function reflection(id: string, prompt: string, placeholder: string): ReflectionExercise {
  return { id, type: 'reflection', prompt, placeholder }
}

export const DEFAULT_LEARNING_CATALOG: LearningCatalog = {
  version: 1,
  paths: [
    {
      id: 'social-skills',
      title: 'Social Intelligence',
      shortTitle: 'Social',
      description: 'Build calm confidence, create real connection, and handle everyday social moments with intention.',
      outcome: 'Connect without performing and communicate with clarity.',
      icon: '🤝',
      accent: 'violet',
      units: [
        {
          id: 'social-presence',
          title: 'Presence before performance',
          description: 'Make people feel safe, seen, and comfortable around you.',
          lessons: [
            makeLesson({
              id: 'social-warm-start',
              title: 'The warm start',
              description: 'Use small signals that make conversation easier for both people.',
              icon: '👋',
              exercises: [
                concept('signal-safety', 'Connection starts before the first sentence', 'People rapidly scan posture, face, distance, and tone for signs of safety. A relaxed face, brief eye contact, visible hands, and a small smile reduce uncertainty without demanding attention.', 'Aim to make the next interaction 10% warmer, not to look perfectly confident.'),
                choice('warm-signal', 'Which opening signal is most likely to feel welcoming?', ['Unbroken eye contact', 'A brief smile and relaxed “hey”', 'Looking away until they speak', 'Speaking as loudly as possible'], 1, 'Warmth is low-pressure. Brief eye contact and a relaxed greeting acknowledge the person without crowding them.'),
                scenario('elevator-start', 'You enter an elevator with a neighbor you have seen twice but never met.', 'What is the strongest first move?', ['Immediately ask what they do for work', 'Put in headphones', 'Smile and say, “Hey, I think we live on the same floor—I’m Patrick.”', 'Wait for them to earn your attention'], 2, 'A shared observation plus a simple introduction gives context and makes responding easy.'),
                reflection('warm-rep', 'Where could you practice one warm start in the next 24 hours?', 'Name the person or setting and the exact first sentence you will use.'),
              ],
            }),
            makeLesson({
              id: 'social-curious-questions',
              title: 'Questions that open people up',
              description: 'Replace interview mode with genuine, useful curiosity.',
              icon: '❓',
              exercises: [
                concept('question-funnel', 'Move from broad to meaningful', 'Good conversations often follow a gentle funnel: begin with the shared context, ask an open question, then follow the energy in the answer. The goal is not more questions; it is one thread worth exploring.', 'Listen for energy words—people become more animated around what matters to them.'),
                choice('open-question', 'Which question creates the most room for an interesting answer?', ['Did you like the event?', 'What has been the most useful idea so far?', 'Are you from here?', 'Is your job busy?'], 1, '“What” questions invite detail and give the other person control over how much to share.'),
                scenario('follow-energy', 'A colleague says, “The launch was chaotic, but I loved solving the onboarding problem.”', 'What should you ask next?', ['“Was the launch on Tuesday?”', '“How long have you worked here?”', '“What made the onboarding problem interesting?”', '“Do you like launches?”'], 2, 'They signaled energy around the onboarding problem. Following that thread shows attention and invites a story.'),
                reflection('curiosity-plan', 'Write one open question you can use in a real conversation this week.', 'Start with “What…”, “How…”, or “Tell me about…”.'),
              ],
            }),
          ],
        },
        {
          id: 'social-connection',
          title: 'Create real connection',
          description: 'Listen, respond, and share in a way that builds trust.',
          lessons: [
            makeLesson({
              id: 'social-listening-loop',
              title: 'The listening loop',
              description: 'Prove you understood before moving the conversation forward.',
              icon: '👂',
              difficulty: 'intermediate',
              exercises: [
                concept('loop-model', 'Receive, reflect, deepen', 'A listening loop has three moves: receive the full thought, reflect its meaning in your own words, and deepen with one relevant question. It prevents the common mistake of waiting only for your turn to speak.', 'Understanding first makes advice, humor, and disagreement land better.'),
                order('loop-order', 'Put the listening loop in the strongest order.', ['Let the person finish', 'Reflect the meaning you heard', 'Ask one relevant follow-up'], 'Receiving before reflecting prevents interruption; reflecting before asking confirms that your follow-up is grounded.'),
                scenario('friend-stressed', 'A friend says, “I keep accepting extra work and now I’m exhausted.”', 'Which response best closes a listening loop?', ['“You should just say no.”', '“Same, my week is worse.”', '“It sounds like being dependable is costing you energy. What makes it hard to push back?”', '“At least you have a job.”'], 2, 'The response names the tension without judging it, then asks a question that helps the friend explore it.'),
                reflection('listening-rep', 'Who would benefit from you listening without fixing this week?', 'Write their name and a follow-up question you could ask.'),
              ],
            }),
            makeLesson({
              id: 'social-stories',
              title: 'Tell stories people can follow',
              description: 'Turn rambling updates into short, memorable stories.',
              icon: '🎬',
              difficulty: 'intermediate',
              exercises: [
                concept('story-spine', 'Context, tension, turn', 'A useful short story needs only three parts: just enough context, the moment something became uncertain, and the turn that changed the outcome. Detail is valuable only when it helps the listener picture the tension.', 'Start closer to the interesting moment and leave sooner after the point lands.'),
                order('story-order', 'Arrange the short-story spine.', ['Set the minimum context', 'Name the tension or surprise', 'Reveal the turn and meaning'], 'The listener first needs orientation, then a reason to care, then a satisfying change or insight.'),
                choice('story-detail', 'Which detail is most worth keeping in a story?', ['Every person’s full name', 'The detail that changes how the listener understands the moment', 'The exact route you drove', 'All events in chronological order'], 1, 'Keep details that sharpen the picture, tension, or meaning. Cut details that merely prove the event happened.'),
                reflection('story-draft', 'Draft a three-sentence story from your week.', 'Sentence 1: context. Sentence 2: tension. Sentence 3: turn or lesson.'),
              ],
            }),
          ],
        },
        {
          id: 'social-confidence',
          title: 'Confident communication',
          description: 'Express needs and create momentum without becoming forceful.',
          lessons: [
            makeLesson({
              id: 'social-boundaries',
              title: 'Clear boundaries, warm tone',
              description: 'Say no, disagree, and ask for changes without unnecessary friction.',
              icon: '🧭',
              difficulty: 'advanced',
              exercises: [
                concept('boundary-model', 'Clarity is kinder than vague resentment', 'A clean boundary names the situation, states your limit, and offers an alternative only when you genuinely want one. Long defenses invite negotiation and can make a reasonable limit sound uncertain.', 'Warmth belongs in your tone; clarity belongs in your words.'),
                choice('clean-no', 'Which response is the clearest respectful boundary?', ['“Maybe, I’ll see, things are crazy…”', '“No, you always ask too much.”', '“I can’t take this on this week. I can review it next Tuesday.”', 'Say yes and quietly resent it'], 2, 'It states the limit without blame and offers a specific alternative that can actually be honored.'),
                scenario('different-opinion', 'Your team is rushing toward a decision you think ignores customer evidence.', 'What is the strongest response?', ['Stay quiet to avoid tension', '“This is a terrible idea.”', '“I see the speed advantage. I’m concerned the last five interviews point the other way—can we test that assumption first?”', 'Complain privately afterward'], 2, 'The response acknowledges the goal, names evidence, and proposes a next step instead of attacking competence.'),
                reflection('boundary-script', 'Write one boundary you need to communicate.', 'Use: “I can’t / I need… What I can do is…”'),
              ],
            }),
            makeLesson({
              id: 'social-invitations',
              title: 'Turn rapport into plans',
              description: 'Make invitations that are easy to understand and answer.',
              icon: '📅',
              difficulty: 'advanced',
              exercises: [
                concept('specific-invite', 'Specific beats “we should”', 'Most social momentum dies in vague goodwill. A strong invitation connects to something discussed and includes a concrete activity, time window, and low-pressure way to respond.', 'Initiative is a gift when the other person can comfortably say yes or no.'),
                choice('best-invite', 'Which invitation is easiest to act on?', ['“We should hang out sometime.”', '“Want to grab coffee at North Café next Thursday after work?”', '“Let me know whenever.”', '“Why don’t people ever make plans?”'], 1, 'A specific plan reduces coordination work and makes the response simple.'),
                scenario('follow-up', 'Someone liked your invitation but did not confirm a time.', 'What is the best follow-up?', ['Send five question marks', 'Assume rejection and disappear', '“I’m booking my week—does Thursday at 18:00 work, or should we leave it for another time?”', 'Accuse them of being flaky'], 2, 'The message is concrete and gives a graceful exit, protecting both your time and the relationship.'),
                reflection('invite-plan', 'Who could you invite to something specific this week?', 'Write the person, activity, place, and time window.'),
              ],
            }),
          ],
        },
      ],
    },
    {
      id: 'entrepreneurship',
      title: 'Entrepreneurship',
      shortTitle: 'Business',
      description: 'Learn to find painful problems, test demand, sell clearly, and operate with evidence.',
      outcome: 'Move from ideas to validated offers and repeatable execution.',
      icon: '🚀',
      accent: 'amber',
      units: [
        {
          id: 'business-discovery',
          title: 'Find a problem worth solving',
          description: 'Replace idea attachment with evidence about customers and pain.',
          lessons: [
            makeLesson({
              id: 'business-problem-first',
              title: 'Problem before product',
              description: 'Separate an exciting idea from a valuable customer problem.',
              icon: '🔎',
              exercises: [
                concept('pain-evidence', 'Problems leave evidence', 'A valuable problem appears in behavior: people spend money, build workarounds, lose time, accept risk, or repeatedly complain. Opinions about an imagined product are weak evidence compared with what people already do.', 'Look for costly behavior, not compliments about your idea.'),
                choice('strong-signal', 'Which is the strongest evidence that a problem matters?', ['Ten friends say the idea is cool', 'A prospect already pays for a clumsy workaround', 'A large market report exists', 'The logo tests well'], 1, 'Existing spend or effort shows the customer has already prioritized the problem.'),
                scenario('idea-praise', 'Five interviewees praise your concept, but none can describe when they last faced the problem.', 'What should you conclude?', ['Demand is validated', 'The price is too low', 'The interviews produced weak evidence; investigate real past behavior', 'Build the full product immediately'], 2, 'Polite enthusiasm predicts little. Specific recent behavior is much more reliable.'),
                reflection('problem-hunt', 'Name one customer group and one costly behavior you want to investigate.', '“I want to understand why [customer] currently [behavior/workaround].”'),
              ],
            }),
            makeLesson({
              id: 'business-interviews',
              title: 'Customer interviews without bias',
              description: 'Ask about reality without selling the answer you hope to hear.',
              icon: '🎤',
              exercises: [
                concept('past-not-future', 'Ask about the past, not promises', 'People are poor at predicting hypothetical buying behavior and often try to be encouraging. Ask about the last specific time the problem occurred, what triggered it, what they tried, and what the outcome cost.', 'A detailed past event beats a confident future promise.'),
                choice('interview-question', 'Which interview question is least biased?', ['Would you pay €20 for my app?', 'Don’t you hate managing invoices?', 'Tell me about the last time an invoice was paid late.', 'Would an AI reminder solve this?'], 2, 'It asks for a concrete event and does not reveal the answer you want.'),
                order('interview-flow', 'Arrange a useful discovery sequence.', ['Ask for the last specific occurrence', 'Trace what happened step by step', 'Explore consequences and current workarounds'], 'Start concrete, reconstruct behavior, then quantify pain and alternatives.'),
                reflection('interview-script', 'Write the first three questions for your next customer interview.', 'Keep them about past behavior. Avoid pitching your solution.'),
              ],
            }),
          ],
        },
        {
          id: 'business-validation',
          title: 'Test value quickly',
          description: 'Design the smallest experiment that can change your decision.',
          lessons: [
            makeLesson({
              id: 'business-smallest-test',
              title: 'The smallest credible test',
              description: 'Learn before you spend months building.',
              icon: '🧪',
              difficulty: 'intermediate',
              exercises: [
                concept('assumption-map', 'Test the riskiest assumption first', 'Every venture rests on assumptions about the customer, pain, channel, willingness to pay, and your ability to deliver. The best first test targets the assumption that could kill the idea and produces behavior you can observe.', 'An experiment is useful only if different results lead to different decisions.'),
                choice('test-choice', 'Before building scheduling software, what is the strongest first demand test?', ['Choose a database', 'Offer a manual scheduling service to five target customers for a real price', 'Design twenty settings screens', 'Register every social handle'], 1, 'A paid concierge offer tests pain, willingness to pay, and delivery learning without product infrastructure.'),
                scenario('landing-page', 'One hundred people visit your landing page. Twelve join a waitlist, but nobody accepts a paid pilot.', 'What did you validate?', ['A scalable business', 'Some message interest, but not willingness to pay', 'The final product price', 'Retention'], 1, 'A waitlist is a weak intent signal. A paid pilot asks for a meaningful commitment.'),
                reflection('experiment-card', 'Define one seven-day validation experiment.', 'Assumption → test → success threshold → what you will do if it fails.'),
              ],
            }),
            makeLesson({
              id: 'business-offer',
              title: 'Build an offer people understand',
              description: 'Connect a specific customer, painful situation, outcome, and proof.',
              icon: '🎯',
              difficulty: 'intermediate',
              exercises: [
                concept('offer-shape', 'Clarity compresses the decision', 'A strong offer tells a specific customer what outcome they can expect, how the mechanism differs, what effort or risk is removed, and why they should believe you. Feature lists make customers translate the value themselves.', 'Describe the progress the customer buys, not the machinery you built.'),
                choice('positioning', 'Which statement is the clearest offer?', ['An AI-powered synergistic platform', 'We help 10–50 person agencies cut overdue invoices by automating polite follow-up', 'The future of finance', 'Software with dashboards and integrations'], 1, 'It names the customer, costly problem, and mechanism in ordinary language.'),
                scenario('price-objection', 'A prospect says, “That feels expensive.”', 'What should you do first?', ['Immediately discount 50%', 'Defend every feature', 'Ask what they are comparing it with and quantify the current cost of the problem', 'End the call'], 2, '“Expensive” is incomplete information. Understand the comparison and value gap before changing price.'),
                reflection('offer-draft', 'Draft your offer in one sentence.', 'We help [specific customer] achieve [outcome] without [cost/risk] by [mechanism].'),
              ],
            }),
          ],
        },
        {
          id: 'business-execution',
          title: 'Sell and operate',
          description: 'Turn learning into revenue and a repeatable weekly rhythm.',
          lessons: [
            makeLesson({
              id: 'business-sales-conversation',
              title: 'A useful sales conversation',
              description: 'Diagnose before you prescribe and ask clearly for commitment.',
              icon: '🤝',
              difficulty: 'advanced',
              exercises: [
                concept('sales-diagnosis', 'Sales is joint diagnosis', 'A good sales conversation establishes the current situation, desired outcome, obstacles, cost of inaction, decision process, and fit. A demo matters only after both sides understand what needs to change.', 'Do not present every feature; connect the few relevant capabilities to diagnosed pain.'),
                order('sales-flow', 'Arrange the core sales flow.', ['Understand the current situation and pain', 'Clarify desired outcome and decision constraints', 'Recommend the relevant solution and agree on a next step'], 'Diagnosis creates the context that makes a recommendation credible.'),
                scenario('vague-next-step', 'The prospect says, “Send me something and I’ll think about it.”', 'What is the strongest response?', ['“Sure” and hope', '“No.”', '“Happy to. What question should the material answer, and shall we review it together Friday?”', 'Send a 60-page deck'], 2, 'It uncovers the real concern and turns a vague promise into a mutual next step.'),
                reflection('sales-question', 'What question are you currently avoiding in a sales conversation?', 'Write the direct, respectful version you will ask next time.'),
              ],
            }),
            makeLesson({
              id: 'business-operating-cadence',
              title: 'The founder operating cadence',
              description: 'Use a weekly evidence loop instead of reacting to noise.',
              icon: '📈',
              difficulty: 'advanced',
              exercises: [
                concept('weekly-loop', 'Focus, evidence, decision', 'A useful operating week starts with one bottleneck, commits to a small set of leading actions, reviews evidence at a fixed time, and records decisions. Metrics without decisions become theater; activity without a bottleneck becomes busyness.', 'Pick the constraint that most limits customer value or growth, then align the week around it.'),
                choice('leading-metric', 'If the bottleneck is too few qualified conversations, which is the best weekly leading metric?', ['Total lifetime revenue', 'Number of targeted outreach messages and booked conversations', 'Website font size', 'Company valuation'], 1, 'It measures controllable actions close to the bottleneck and can change within the week.'),
                scenario('too-many-priorities', 'Your team has twelve “top priorities” this week.', 'What is the best operator move?', ['Work longer on all twelve', 'Choose the bottleneck, define one outcome, and explicitly defer lower-leverage work', 'Add more dashboards', 'Avoid making a choice'], 1, 'Strategy requires tradeoffs. A visible not-now list protects the work that matters most.'),
                reflection('weekly-scorecard', 'Design your next weekly founder scorecard.', 'One bottleneck, one outcome, three leading actions, one review time.'),
              ],
            }),
          ],
        },
      ],
    },
    {
      id: 'fitness',
      title: 'Strength & Fitness',
      shortTitle: 'Fitness',
      description: 'Train with sound principles, recover deliberately, and build a body through sustainable progression.',
      outcome: 'Make confident training decisions without chasing noise.',
      icon: '💪',
      accent: 'emerald',
      units: [
        {
          id: 'fitness-training',
          title: 'Train for adaptation',
          description: 'Understand the signals that make strength and muscle grow.',
          lessons: [
            makeLesson({
              id: 'fitness-progressive-overload',
              title: 'Progressive overload',
              description: 'Create a measurable reason for your body to adapt.',
              icon: '📊',
              exercises: [
                concept('overload-model', 'Progress is more than adding weight', 'Progressive overload means increasing the training challenge over time while preserving the target movement and useful technique. Load, repetitions, range of motion, control, and total hard sets can all progress.', 'Compare similar work. A heavier sloppy rep is not automatically better stimulus.'),
                choice('progress-example', 'Which is the clearest example of useful overload?', ['Bench 70 kg for 8 clean reps after doing 7 last week', 'Add 20 kg and halve the range of motion', 'Change every exercise weekly', 'Train until exhausted every day'], 0, 'One additional clean rep at the same load and technique is measurable progress.'),
                scenario('stalled-load', 'You cannot add weight to an exercise this week, but your technique and recovery are good.', 'What is a sensible next progression?', ['Quit the program', 'Add one controlled rep within the target range', 'Double all sets immediately', 'Use momentum to move the load'], 1, 'Rep progression is a small, trackable increase that preserves exercise quality.'),
                reflection('overload-target', 'Choose one lift and define its next smallest progression.', 'Exercise, current load/reps, and the next target.'),
              ],
            }),
            makeLesson({
              id: 'fitness-effort-technique',
              title: 'Hard sets with stable technique',
              description: 'Balance effort, proximity to failure, and repeatable execution.',
              icon: '🎚️',
              exercises: [
                concept('rir-model', 'Effort needs a reference', 'Reps in reserve (RIR) estimates how many clean repetitions remained before technical failure. Many productive hypertrophy sets finish around 0–3 RIR, but the right effort depends on exercise safety, skill, fatigue, and program design.', 'A hard set should challenge the target muscle without turning into a different movement.'),
                choice('rir-check', 'You finish a set and could perform two more clean reps. What is the estimate?', ['0 RIR', '1 RIR', '2 RIR', '5 RIR'], 2, 'RIR counts the clean repetitions you believe remained.'),
                scenario('form-breakdown', 'During curls, your torso swing increases and the elbow position changes to finish more reps.', 'What is the best interpretation?', ['The target muscle received perfect overload', 'The set has reached technical failure for the intended execution', 'Technique never matters', 'Add more weight immediately'], 1, 'When the agreed technique breaks, the target movement has ended even if the weight still moves.'),
                reflection('technique-standard', 'Define one non-negotiable technique standard for a key exercise.', 'Example: full controlled depth, stable torso, or a one-second pause.'),
              ],
            }),
          ],
        },
        {
          id: 'fitness-recovery',
          title: 'Fuel and recover',
          description: 'Support training with practical nutrition and sleep decisions.',
          lessons: [
            makeLesson({
              id: 'fitness-protein-energy',
              title: 'Protein and energy balance',
              description: 'Build a simple nutrition base for muscle gain or fat loss.',
              icon: '🥗',
              difficulty: 'intermediate',
              exercises: [
                concept('nutrition-hierarchy', 'Start with the large levers', 'Body-weight direction is primarily influenced by sustained energy balance, while adequate protein supports muscle retention and growth. Food quality, fiber, and micronutrients support health and adherence; timing fine-tunes a sound base.', 'A repeatable nutrition system beats perfect targets followed for three days.'),
                choice('priority', 'For a lifter starting a fat-loss phase, which foundation matters most?', ['A sustainable calorie deficit with adequate protein', 'Eliminating all carbohydrates', 'One exact meal timing window', 'Buying more supplements'], 0, 'A manageable deficit drives weight loss while protein and resistance training help preserve lean mass.'),
                scenario('protein-gap', 'You consistently miss your protein target at dinner and then snack randomly.', 'What is the most practical system fix?', ['Rely on more willpower at night', 'Add a repeatable protein anchor to breakfast or lunch', 'Skip breakfast and lunch', 'Change targets every day'], 1, 'Moving some protein earlier reduces the size of the evening problem and creates a reliable default.'),
                reflection('protein-anchor', 'Choose one repeatable protein anchor for your day.', 'Food, portion, meal, and approximate protein.'),
              ],
            }),
            makeLesson({
              id: 'fitness-sleep-recovery',
              title: 'Recovery is part of training',
              description: 'Use sleep, fatigue signals, and rest to protect adaptation.',
              icon: '😴',
              difficulty: 'intermediate',
              exercises: [
                concept('stress-balance', 'Training spends recovery capacity', 'Muscle and strength adaptation happen after the workout. Sleep, nutrition, life stress, and training load draw from the same recovery budget. One bad night is not a crisis; a repeated mismatch between stress and recovery is a programming signal.', 'Judge recovery by trends in performance, motivation, soreness, sleep, and joint comfort.'),
                choice('recovery-signal', 'Which pattern most strongly suggests accumulated fatigue?', ['One difficult warm-up rep', 'Several sessions of falling performance plus worse sleep and persistent soreness', 'Feeling energetic after rest', 'A single missed meal'], 1, 'Multiple worsening signals across several sessions are more informative than one noisy data point.'),
                scenario('bad-night', 'You slept poorly once before a normal training day.', 'What is the best first response?', ['Abandon training for a month', 'Use the warm-up to assess readiness and adjust load or volume if needed', 'Attempt a personal record regardless', 'Double caffeine and ignore technique'], 1, 'Autoregulation uses current performance evidence without overreacting to one night.'),
                reflection('shutdown-routine', 'Design a 20-minute pre-sleep shutdown you could repeat.', 'Time, screens, light, preparation, and one calming action.'),
              ],
            }),
          ],
        },
        {
          id: 'fitness-programming',
          title: 'Program for the long game',
          description: 'Organize training and respond intelligently when progress slows.',
          lessons: [
            makeLesson({
              id: 'fitness-program-design',
              title: 'A program you can progress',
              description: 'Choose enough structure to learn what is working.',
              icon: '🗓️',
              difficulty: 'advanced',
              exercises: [
                concept('program-structure', 'Consistency makes data useful', 'A useful program repeats key movement patterns long enough to practice technique and compare performance. It distributes weekly volume, manages fatigue, and fits the days you can realistically train. Novelty can be enjoyable, but constant change hides whether you are progressing.', 'The best split is one you can recover from and execute consistently.'),
                order('program-order', 'Arrange the basic programming decisions.', ['Choose realistic weekly training days', 'Distribute priority muscle groups and movements', 'Set progression rules and track comparable work'], 'Schedule constraints come first, then training distribution, then a clear way to progress.'),
                scenario('missed-day', 'Your four-day plan repeatedly becomes three days because Friday is unpredictable.', 'What is the best adjustment?', ['Keep failing the same schedule', 'Build a three-day base that covers priorities, with an optional fourth day', 'Do all four sessions on Sunday', 'Stop tracking'], 1, 'Programming around reality improves consistency and makes the optional work genuinely optional.'),
                reflection('program-audit', 'What is the biggest mismatch between your current program and your real week?', 'Name the conflict and one structural change.'),
              ],
            }),
            makeLesson({
              id: 'fitness-plateaus',
              title: 'Diagnose a plateau',
              description: 'Respond to stalled progress with evidence instead of random changes.',
              icon: '🛠️',
              difficulty: 'advanced',
              exercises: [
                concept('plateau-check', 'A plateau is a diagnosis, not a mood', 'Before changing a program, confirm that comparable performance has stalled across enough exposures. Then check technique, effort, sleep, nutrition, body-weight trend, pain, and total fatigue. The solution may be more stimulus, better recovery, a technique correction, or a planned deload.', 'Change one likely constraint at a time so the result teaches you something.'),
                order('plateau-order', 'Put the plateau response in the strongest order.', ['Confirm the stall with comparable logged sessions', 'Check execution, recovery, nutrition, and pain', 'Change the smallest likely constraint and reassess'], 'First establish that a real pattern exists, then diagnose, then intervene.'),
                scenario('everything-stalled', 'Several lifts fall for two weeks, sleep is poor, motivation is low, and joints feel irritated.', 'What is the most reasonable first move?', ['Add failure sets to every exercise', 'Consider a short deload and restore recovery before rebuilding', 'Change every exercise and diet variable', 'Ignore it indefinitely'], 1, 'System-wide decline plus recovery symptoms suggests fatigue management before adding more stress.'),
                reflection('plateau-decision', 'Write a decision rule for your next plateau.', 'If [evidence persists], I will check [inputs] and change [smallest variable].'),
              ],
            }),
          ],
        },
      ],
    },
  ],
}

export const EMPTY_LEARNING_PROGRESS: LearningProgress = {
  version: 1,
  completions: {},
  reflections: {},
}

export function getPathLessons(path: LearningPath): PathLesson[] {
  return path.units.flatMap((unit) => unit.lessons)
}

export function findPathLesson(catalog: LearningCatalog, lessonId: string) {
  for (const path of catalog.paths) {
    for (const unit of path.units) {
      const lesson = unit.lessons.find((item) => item.id === lessonId)
      if (lesson) return { path, unit, lesson }
    }
  }
  return null
}

export function getNextLessonId(catalog: LearningCatalog, lessonId: string) {
  const located = findPathLesson(catalog, lessonId)
  if (!located) return null
  const lessons = getPathLessons(located.path)
  const index = lessons.findIndex((lesson) => lesson.id === lessonId)
  return lessons[index + 1]?.id ?? null
}

export function isLessonUnlocked(
  path: LearningPath,
  lessonId: string,
  progress: LearningProgress
) {
  const lessons = getPathLessons(path)
  const index = lessons.findIndex((lesson) => lesson.id === lessonId)
  if (index <= 0) return index === 0
  return Boolean(progress.completions[lessons[index - 1].id])
}

export function getPathCompletion(path: LearningPath, progress: LearningProgress) {
  const lessons = getPathLessons(path)
  const completed = lessons.filter((lesson) => progress.completions[lesson.id]).length
  return {
    completed,
    total: lessons.length,
    percent: lessons.length === 0 ? 0 : Math.round((completed / lessons.length) * 100),
  }
}

export function getTotalMasteryPoints(catalog: LearningCatalog, progress: LearningProgress) {
  return catalog.paths.reduce(
    (total, path) =>
      total +
      getPathLessons(path).reduce(
        (pathTotal, lesson) =>
          pathTotal + (progress.completions[lesson.id] ? lesson.masteryPoints : 0),
        0
      ),
    0
  )
}

export function validateLearningCatalog(
  value: unknown,
  options: { answersRequired?: boolean } = {}
): value is LearningCatalog {
  if (!value || typeof value !== 'object') return false
  const catalog = value as Partial<LearningCatalog>
  if (catalog.version !== 1 || !Array.isArray(catalog.paths) || catalog.paths.length === 0) return false

  const allowedPathIds = new Set<LearningPathId>(['social-skills', 'entrepreneurship', 'fitness'])
  const allowedAccents = new Set<LearningPath['accent']>(['violet', 'amber', 'emerald'])
  const allowedDifficulties = new Set<LearningDifficulty>(['foundation', 'intermediate', 'advanced'])
  const pathIds = new Set<string>()
  const unitIds = new Set<string>()
  const lessonIds = new Set<string>()
  for (const path of catalog.paths) {
    if (
      !allowedPathIds.has(path.id) ||
      pathIds.has(path.id) ||
      !path.title ||
      !path.shortTitle ||
      !path.description ||
      !path.outcome ||
      !path.icon ||
      !allowedAccents.has(path.accent) ||
      !Array.isArray(path.units) ||
      path.units.length === 0
    ) {
      return false
    }
    pathIds.add(path.id)
    for (const unit of path.units) {
      if (
        !unit.id ||
        unitIds.has(unit.id) ||
        !unit.title ||
        !unit.description ||
        !Array.isArray(unit.lessons) ||
        unit.lessons.length === 0
      ) {
        return false
      }
      unitIds.add(unit.id)
      for (const lesson of unit.lessons) {
        if (
          !lesson.id ||
          !lesson.title ||
          !lesson.description ||
          !lesson.icon ||
          lessonIds.has(lesson.id) ||
          !allowedDifficulties.has(lesson.difficulty) ||
          !Number.isFinite(lesson.estimatedMinutes) ||
          lesson.estimatedMinutes < 1 ||
          !Number.isFinite(lesson.masteryPoints) ||
          lesson.masteryPoints < 0 ||
          !Array.isArray(lesson.exercises) ||
          lesson.exercises.length === 0
        ) {
          return false
        }
        lessonIds.add(lesson.id)
        for (const exercise of lesson.exercises) {
          if (!exercise.id || !exercise.type) return false
          switch (exercise.type) {
            case 'concept':
              if (!exercise.title || !exercise.body || !exercise.takeaway) return false
              break
            case 'choice':
            case 'scenario':
              const correctIndexIsValid =
                Number.isInteger(exercise.correctIndex) &&
                exercise.correctIndex! >= 0 &&
                exercise.correctIndex! < exercise.options.length
              if (
                !exercise.prompt ||
                (exercise.type === 'scenario' && !exercise.context) ||
                !exercise.explanation ||
                !Array.isArray(exercise.options) ||
                exercise.options.length < 2 ||
                exercise.options.some((option) => !option.trim()) ||
                (options.answersRequired !== false && !correctIndexIsValid) ||
                (exercise.correctIndex !== undefined && !correctIndexIsValid)
              ) {
                return false
              }
              break
            case 'order':
              if (
                !exercise.prompt ||
                !exercise.explanation ||
                !Array.isArray(exercise.items) ||
                exercise.items.length < 2 ||
                exercise.items.some((item) => !item.trim()) ||
                new Set(exercise.items).size !== exercise.items.length
              ) {
                return false
              }
              break
            case 'reflection':
              if (!exercise.prompt || !exercise.placeholder) return false
              break
            default:
              return false
          }
        }
      }
    }
  }
  return true
}
