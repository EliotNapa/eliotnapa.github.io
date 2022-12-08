import numpy as np

#長方形近似の関数。区間[0,1]をN等分する。
def Rectangle(N):
    x = np.arange(N) / N #0~(N-1)/NまでのN要素配列
    y = np.sqrt(1 - x**2) #y=root(1-x^2)を計算
    pi = 4 * np.sum(y) / N #面積を計算
    return pi

#出力
print("Rectangle(100)     = " + str(Rectangle(100)))
print("Rectangle(1000)    = " + str(Rectangle(1000)))
print("Rectangle(10000)   = " + str(Rectangle(10000)))
print("Rectangle(100000)  = " + str(Rectangle(100000)))
print("Rectangle(1000000) = " + str(Rectangle(1000000)))
