#  Virtual Try-On




This project supports real-time virtual try-on without the need for any special sensors. All you need is a webcam and a PC with a GPU equivalent to an RTX 3060 or higher.


Our method simply overlay the synthesized garment on the top of human body without removing the original garment to achieve real-time performace.





## Installation

```
git clone https://github.com/sinchanadk052/VITRY
cd RTV
```

### Environment
```
sudo apt install gcc g++ libxcb-xinerama0-dev libxcb-icccm4-dev libxcb-image0-dev libxcb-keysyms1-dev libxcb-randr0-dev libxcb-shape0-dev libxcb-sync-dev libxcb-xfixes0-dev libxcb-xkb-dev 
sudo apt install qtbase5-dev qtbase5-dev-tools libqt5gui5 libqt5widgets5 libqt5multimedia5 libqt5multimediawidgets5 libqt5multimedia5-plugins libpulse-mainloop-glib0
conda create -n rtv python=3.12
conda activate rtv
pip install -r requirements.txt
pip install --no-build-isolation detectron2@git+https://github.com/facebookresearch/detectron2.git
pip install --no-build-isolation git+https://github.com/ZaiqiangWu/ROMP.git#subdirectory=simple_romp
```

### Weights
Download our pretrained checkpoints by running the following command. Please refer to [this page](./training_instructions.md) for instructions on training your own garment items.
```
sudo apt install git-lfs
git lfs install


```

### Real-time virtual try-on
Please make sure that there is a webcam connected to your PC before running the following command.
```
python rtl_demo.py
```


```

