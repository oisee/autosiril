def module_header(title,play_order,ornaments_txt)
	"[Module]
VortexTrackerII=0
Version=3.5
Title=#{title}
Author=oisee/siril^4d #{Time.new.strftime("%Y.%m.%d")}
NoteTable=4
ChipFreq=1750000
Speed=4
PlayOrder=#{play_order}
ArgList=#{ARGV.join(' ')}

#{ornaments_txt}

[Sample1]
TnE +000_ +00_ F_
TnE +000_ +00_ F_
TnE +000_ +00_ F_
TnE +000_ +00_ D_
TnE +000_ +00_ B_
TnE +000_ +00_ B_ L

[Sample2]
TnE +000_ +00_ F_ L

[Sample3]
TnE +001_ +00_ F_
TnE +002_ +00_ F_
TnE +001_ +00_ E_
TnE +002_ +00_ E_
TnE +000_ +00_ E_ L
TnE -001_ +00_ E_
TnE -002_ +00_ E_
TnE -001_ +00_ E_
TnE +000_ +00_ E_
TnE +001_ +00_ E_
TnE +002_ +00_ E_
TnE +001_ +00_ E_

[Sample4]
TnE +002_ +00_ D_
TnE +002_ +00_ D_
TnE +002_ +00_ C_
TnE +002_ +00_ B_
TnE +002_ +00_ A_ L
TnE +002_ +00_ A_
TnE +002_ +00_ A_
TnE +002_ +00_ A_
TnE +002_ +00_ A_
TnE +002_ +00_ A_
TnE +002_ +00_ A_
TnE +002_ +00_ A_

[Sample5]
TnE +000_ +00_ F_
TnE +000_ +00_ F_
tne +000_ +00_ 0_ L

[Sample6]
TnE -001_ +00_ F_ L

[Sample7]
TnE +006_ +00_ F_ L

[Sample8]
tNe +000_ +00_ F_
tNe +000_ +00_ B_
tNe +000_ +00_ 7_
tNe +000_ +00_ 6- L

[Sample9]
TnE +080_ +00_ F_
TnE +100_ +00_ E_
TnE +180_ +00_ E_
TnE +200_ +00_ E_
TnE +240_ +00_ D_
TnE +280_ +00_ D_
TnE +2C0_ +00_ D_
TnE +300_ +00_ C_
TnE +300_ +00_ C_
TnE +340_ +00_ C_
TnE +340_ +00_ C_
TnE +380_ +00_ B_
TnE +380_ +00_ B_
TnE +400_ +00_ B_
TnE +400_ +00_ B_
TnE +480_ +00_ A_
TnE +500_ +00_ 9_
TnE +580_ +00_ 7_
TnE +600_ +00_ 4_
TnE +680_ +00_ 1_
TnE +000_ +00_ 0_ L

[Sample10]
Tne +1C0_ +00_ F_
Tne +280_ +00_ E_
Tne +380_ +00_ C_
Tne +440_ +00_ A_
Tne +480_ +00_ 8_
TnE +000_ +00_ 0_ L

[Sample11]
TNe +200_ -0A_ F_
tNe +000_ +0F_ A_
TNe +200_ -07_ E_
tNe +000_ +0E_ B- L

[Sample12]
TNE +0A0_ +05_ F_
TNE +140_ +02_ D_
TNE +140_ +02_ B_
TNE +100_ +00_ A_ L
TNE +140_ +00_ A_
TNE +200_ +00_ A-

[Sample13]
Tne +200_ +00_ F_
Tne +2C0_ +00_ F_
Tne +380_ +00_ E_
Tne +500_ +00_ C_
Tne +520_ +00_ 9_
tne +000_ +00_ 0_ L

[Sample14]
TNE -100_ +00_ F_
TNE -100_ +00_ D_
TNE -100_ +00_ A_
TNE -100_ +00_ 5_
tne +000_ +00_ 0_ L

[Sample15]
TNE -100_ +00_ 5_
TNE -100_ +00_ 8_
TNE -100_ +00_ B_
TNE -100_ +00_ F_
TNe -100_ +00_ 9- L

[Sample16]
TnE +000_ +00_ C_
TnE +000_ +00_ E_
TnE +000_ +00_ F_
TnE +000_ +00_ F_
TnE +000_ +00_ E_
TnE +000_ +00_ D_
TnE +000_ +00_ C_
TnE +000_ +00_ C_ L
TnE +001_ +00_ C_
TnE +002_ +00_ C_
TnE +003_ +00_ C_
TnE +001_ +00_ C_
TnE +000_ +00_ C_
TnE -001_ +00_ C_
TnE -002_ +00_ C_
TnE -003_ +00_ C_
TnE -001_ +00_ C_
TnE +000_ +00_ C_
TnE +000_ +00_ C_

[Sample17]
Tne +1C0_ +00_ F_
Tne +280_ +00_ D_
Tne +380_ +00_ 7_
TNE +000_ +00_ 0_ L

[Sample18]
TnE -00C_ +00_ 0_ L

[Sample19]
TNe +000_ +00_ F_
TNe +000_ +00_ C_
TNe +000_ +00_ 6_
TNe +000_ +01_ A- L

[Sample20]
TNE +140_ +00_ F_
tNE +000_ +00_ B- L

[Sample21]
tNE +000_ +00_ D_
tNE +000_ +00_ 8_
tNE +000_ +00_ 1_
TNE +000_ +00_ 0_ L

[Sample22]
TnE +000_ +00_ D_ L
TnE +000_ +00_ D_
tne +000_ +00_ 9_
tne +000_ +00_ 9_
TnE +000_ +00_ D_
TnE +000_ +00_ D_
tne +000_ +00_ 9_
tne +000_ +00_ 9_
TnE +000_ +00_ D_
TnE +000_ +00_ D_
TnE +000_ +00_ D_
TnE +000_ +00_ D_
TnE +000_ +00_ D_
TnE +000_ +00_ D_
tne +000_ +00_ 9_
tne +000_ +00_ 9_

[Sample23]
TnE +000_ +00_ F_ L
TnE +010_ +01_ F_
TnE +010_ +01_ F_
TnE +010_ +01_ F_
TnE +010_ +01_ F_
TnE +000_ +00_ F_
TnE +000_ +00_ F_
TnE -010_ -01_ F_
TnE -010_ -01_ F_
TnE -010_ -01_ F_
TnE -010_ -01_ F_
TnE +000_ +00_ F_

[Sample24]
TNe +000_ -01_ C_
TNe +000_ -01_ D_
TNe +000_ -01_ E_
TNe +000_ -01_ F_
TNe +000_ -01_ F_
TNe +000_ -01_ F_
TNe +000_ -01_ F_
TNe +000_ -01_ F_
TNe +000_ -01_ E_
TNe +000_ -01_ E_
TNe +000_ -01_ E_
TNe +000_ -01_ F_
TNe +000_ -01_ F_ L

[Sample25]
TNE +000_ +00_ F_
TNE +000_ +00_ F_ L
TNE +000_ +00_ F_
TNE +000_ +00_ F_
TNE +000_ +00_ F-

[Sample26]
tne +000_ +00_ 0_ L

[Sample27]
TnE +100_ +05_ F_
TnE +200_ +02_ A_
TnE +300_ +02_ 7_
TNE +400_ +00_ 3- L

[Sample28]
tne +000_ +00_ 0_ L

[Sample29]
tnE +000_ +00_ 0_ L

[Sample30]
TNE +000_ +00_ C+ L

[Sample31]
TNe +1C0_ +00_ F_
Tne +280_ +00_ E_
Tne +380_ +00_ C_
Tne +440_ +00_ A_
Tne +480_ +00_ 8_
TnE +000_ +00_ 0_ L"
end