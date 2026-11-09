# 玉露模型源文件

`haworthia-growth.blend` 用 Blender 4.3.2 制作，包含幼苗、展叶、成株和成熟四组植株，贴图已打包。默认显示成熟株。编辑其他阶段时，在 Outliner 打开对应植株的可见性。

每次只选择一个植株，通过「文件 → 导出 → glTF 2.0」导出二进制 GLB。启用「仅选中物体」和「+Y 向上」，以米为单位，保持原点在土面中心。不要导出审查场景的灯光、地面和相机。按阶段覆盖 `frontend/assets/plants/haworthia/` 下的 `01-seedling.glb`、`02-juvenile.glb`、`03-rosette.glb` 或 `04-mature.glb`，然后重新构建并在游戏里核对窗台和特写。
