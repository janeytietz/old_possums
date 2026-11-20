# Art prompts for more beasts

These match the writing cat that's in the app now. Attach the cat draft
(`tools/art-src/cat-desk-writing-v2-color.jpg`) as a style reference if your tool allows it,
paste the **style block** first, then one **beast prompt**.

Keep the scene the same every time (desk on the left, beast on a stool on the right, square
image, plain paper). Then each new beast can go through the same tracing steps as the cat.

---

## Style block (always include)

```
Hand-coloured woodcut illustration in the manner of a 15th-century printed bestiary. Confident black ink outlines that vary in thickness, with only a little hatching where a shape needs it: leave large areas plain. Colour is a few flat watercolour washes from a small palette (ochre, vermilion, verdigris green, lapis blue, warm brown, cream), laid on slightly loosely. Plain warm off-white paper background with no texture and no ground shadow. The animal has slightly odd, gangly medieval proportions and a calm, friendly expression; it is not cute and not chibi. One subject, full figure, centred in a square 1:1 image with a generous margin.
Avoid: dense, even hatching everywhere, smooth gradients or airbrushed shading, glossy highlights, perfect perspective, 3D, photographic detail, extra props, and any text or lettering.
```

## Beast prompt (writing, the focus pose)

Replace `[BEAST]`:

```
[BEAST] sitting on a small round wooden stool at a small green wooden writing desk, writing in an open red-edged book with a feather quill. A small blue ink pot sits on the desk. The desk is on the left, the animal on the right, seen from the front left, with its whole body and tail visible.
```

## The other poses (same beast, same desk)

```
The same [BEAST] at the same desk and stool, holding a small cup of tea in both front paws with its eyes contentedly closed. The quill rests on the open book.
```

```
The same [BEAST] at the same desk and stool, fast asleep with its head resting on the open book.
```

## The possum's other poses (it's the default buddy)

Attach `tools/art-src/possum-writing-source.jpg` as the reference so it stays the same possum.

On a break:

```
The same possum at the same green desk and wooden stool, holding a small cup of tea in both pink front paws, eyes contentedly closed, still grinning. The quill rests on the open book. Same framing and size as the reference.
```

When you're away (playing dead):

```
The same possum flopped on its back on top of the green desk beside the open book, all four pink feet in the air, tail curled over the edge, eyes shut and tongue out, playing dead. Funny and harmless, not gruesome. The stool stands empty. Same framing and size as the reference.
```

## The hungry pig (stand-in drawn in code for now: js/pig.js)

A nod to Porky the Litter Eater, drawn our own way. Same style block; same square framing, plain paper:

```
A small round wooden tub with two iron hoops, with a friendly pig's face carved and painted on its front: round pink snout with two nostrils, small dark eyes, an open grinning mouth like a letter slot, and two pink pig ears poking up over the rim. It stands on its own, front view, a little crooked, as if it has been waiting by a writing desk for scraps of paper. Funny and harmless.
```

Ask for a second image with the mouth wide open (mid-chomp) so the trace can swap mouths.

## Beasts to earn from cards

- a cat at the same desk (already drawn: tools/art-src/cat-desk-writing-v2-color.jpg)
- a hare whose back half lives in a pink snail shell
- a round owl standing on very tall, thin legs instead of sitting on the stool
- a fox wearing a plain brown monk's robe
- a small frog wearing a knight's helmet that is too big for it
- a hedgehog with a few quills sticking out of its back like pens
- a hen with a curly dragon tail and small bat wings
- a small elephant carrying a tiny stone castle on its back, sitting on a sturdier stool

## Tips

- If it comes back too busy, add: *"fewer lines, more empty paper, like a quick print"*.
- If it looks too polished or AI-made, add: *"crude, slightly wonky lines, uneven colour, as if printed from a hand-cut wooden block"*.
- If the face goes creepy, add: *"gentle, friendly face like a children's picture book"*.
- Keep words out of the pictures. The app adds names and numbers itself.
