---
name: pstack-humanize-writing
description: 去掉文字里的 AI 味：套话、空泛归因、AI 词汇、三段式、装饰性破折号与表情、聊天机器人腔。改文档、README、PR 描述、提交信息、回复时使用。
whenToUse: 用户要求「unslop」「去 AI 味」「收紧措辞」，或你写完一段文字准备交付前。
---

# 去 AI 味

按下面的模式扫描，然后改写。保留原意，匹配预期语气。

规则编号是稳定 id，其他技能会引用。删除的规则留空号。

3. 不加不承载事实的 `-ing` 尾句（"highlighting..."、"ensuring..."）。
5. 不做空泛归因（"experts believe"）。点名来源，或者删掉。
7. 不用 AI 词汇：additionally、crucial、delve、enhance、foster、landscape、pivotal、showcase、testament、underscore、vibrant。
8. 说 "is" 或 "has"，不用 "serves as"、"stands as"、"boasts"、"features"。
9. 不用 "not just X, but Y"。直接说结论。
10. 不把想法硬凑成三个。
11. 一个东西一个名字，重复使用它。
12. 不用 "from X to Y"，除非 X 和 Y 处在真实尺度上。
13. 不用 em dash、en dash、或用连字符代替破折号，也不要用括号顶替。用句号或逗号。
14. 冒号只用在列表或示例前，不用作句中的连接词。
15. 不把每个专有名词或缩写都加粗。
16. 不用「加粗标签 + 冒号」复述本行（"**Performance:** Performance improved..."）。以句号结尾并补充新信息的加粗引导语可以。
17. 标题用句首大写。
18. 不用装饰性 emoji。
19. 用直引号。
20. 不用聊天机器人腔（"I hope this helps!"、"Let me know if..."）。
22. 不用赞美或附和的开场。直接回应。
23. 删填充词。"In order to" 改 "to"，删 "it is important to note that"。
24. 最多一个模糊限定词："may"。
25. 不写通用结论。给出具体计划或事实。
26. 不用抽象隐喻名词：substrate、wedge、vector、nexus、primitive、harness、surface、scaffolding、paradigm、ratchet、north star、flywheel。用具体的词。
27. 说它做什么，不说它感觉如何。给出机制或数字。删掉换成别的项目也成立的句子。
28. 一句话一个意思。读者需要重读的句子拆开。
29. 用主动语态。指出施动者，除非未知或不重要。
30. 删副词或换更强的动词。给出数字。
31. 用朴素词："use"，不用 "utilize" 或 "leverage"。
32. 不用隐喻、格言、拟人化代码，或有字面说法却用比喻动词。
33. 写完整句子，带冠词和动词。把箭头和缩写展开成词。

来源：pstack 的 `unslop` 技能（MIT），规则编号与上游保持一致。
