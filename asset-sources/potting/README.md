# 盆栽材料模型

`potting-materials.blend` 是用 Blender 4.3.2 制作的可编辑源文件。七份材料样本使用顶点色和不同的颗粒轮廓。雨花石使用圆润颗粒与色带，黄金麦饭石使用暖金色碎粒，陶粒使用红陶色多孔颗粒。

从项目根目录运行 `blender -b --python-exit-code 1 --python asset-sources/potting/build_materials.py` 可重建源文件、`frontend/assets/potting/` 里的 GLB 以及透明商店缩略图。各 GLB 只包含一个材料样本，原点在样本基底中心，Y 轴向上，无贴图和外部依赖。
